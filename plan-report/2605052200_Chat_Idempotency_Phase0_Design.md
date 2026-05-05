# Chat Quota/Idempotency — Phase 0 설계 문서

> **문서 ID:** 2605052200
> **작성일:** 2026-05-05
> **작성자:** 기술 리더 + API 신뢰성/분산 시스템 전문가
> **상태:** 설계 완료, 사용자 승인 대기
> **연관 결정 문서:** `docs/decision-chat-quota-idempotency.md` (옵션 C 채택)

---

## 본 세션에서 한 일과 하지 않은 일

| 영역 | 본 세션 | 별도 세션 (사용자 승인 후) |
|---|---|---|
| 현재 `/api/chat` 흐름 매핑 | ✅ | — |
| 위험 지점 식별 | ✅ | — |
| API 계약 설계 | ✅ | — |
| DB 스키마 설계 | ✅ | — |
| RPC 함수 설계 | ✅ | — |
| Feature Flag/롤백 전략 | ✅ | — |
| 마이그레이션 SQL 파일 작성 | — | **Phase 1** |
| `route.ts` / `useChat.ts` 수정 | — | **Phase 2~3** |
| 통합 테스트 + 점진 롤아웃 | — | **Phase 4** |

> ⚠️ 결정 문서가 명시: "DB schema와 RPC 계약이 바뀌므로 자동 실행하지 않는다"

---

## 1. 현재 흐름 핵심 진단

| 위험 | 위치 | 현재 방어 | 영향 |
|---|---|---|---|
| 60초 타임아웃 후 abort + 재전송 | `useChat.ts` finally 블록 | 미방어 | quota 2회 차감, user 메시지 2회 저장 |
| 네트워크 에러 후 수동 재전송 | `useChat.ts` catch 블록 | 미방어 | quota 2회 차감 가능 |
| 스트림 중간 abort 후 재시도 | 서버 미감지 | 미방어 | quota 차감됨, assistant 미저장 |
| 다중 탭 동시 동일 질문 | 서버 식별 불가 | 미방어 (idempotency 범위 밖) |
| 더블 클릭 | `useChat.ts:175` `isLoading` 가드 | 방어됨 ✅ | 없음 |

**핵심 취약점**: 클라이언트 생성 idempotency key 부재 → 서버가 중복 요청을 식별할 방법이 전혀 없음.

---

## 2. API 계약 (요약)

### 요청

```http
POST /api/chat
Idempotency-Key: <UUID v4>          ← flag ON 시 필수
Content-Type: application/json

{ messages, model?, sessionId?, projectId?, coachId? }
```

### 응답 6가지 케이스

| 시나리오 | Status | Body | X-Idempotency-Status |
|---|---|---|---|
| 정상 첫 요청 | 200 stream | LLM stream | `reserved` |
| 중복 재전송, 응답 캐시 존재 | 200 stream | 캐시된 snapshot 재생 | `replayed` |
| 동일 키 다른 body | 409 | `IDEMPOTENCY_CONFLICT` | `conflict` |
| Quota 초과 | 429 | `usage_limit_exceeded` | — |
| 처리 중 (아직 commit 전) | 202 | `PROCESSING`, Retry-After: 3 | — |
| LLM 실패 (스트림 시작 후) | 200 stream | `❌ 오류...` 텍스트 | — |

---

## 3. DB Schema

### `chat_idempotency_keys`

```sql
CREATE TABLE IF NOT EXISTS public.chat_idempotency_keys (
  idempotency_key   TEXT NOT NULL,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_hash      TEXT NOT NULL,                                      -- SHA-256 hex (64)
  status            TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'committed', 'failed')),
  response_snapshot JSONB,                                              -- ≤ 128KB
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (idempotency_key, user_id)                                -- 사용자별 namespace
);

CREATE INDEX idx_chat_idempotency_expires_at ON ... (expires_at);
CREATE INDEX idx_chat_idempotency_user_id    ON ... (user_id);
CREATE INDEX idx_chat_idempotency_status     ON ... (status) WHERE status = 'processing';

ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- SELECT/INSERT/UPDATE 모두 USING (auth.uid() = user_id)
```

### Cleanup (pg_cron, 매 정시)

```sql
SELECT cron.schedule(
  'cleanup-expired-idempotency-keys', '0 * * * *',
  $$ DELETE FROM public.chat_idempotency_keys WHERE expires_at < NOW(); $$
);
```

---

## 4. RPC 함수 3종

| 함수 | 입력 | 반환 | 동작 |
|---|---|---|---|
| `reserve_chat_idempotency_key(key, hash, user_id)` | UUID, hash, user_id | `{action: 'proceed'\|'replay'\|'processing'\|'conflict', response_snapshot?}` | INSERT 또는 ON CONFLICT 처리. SELECT FOR UPDATE로 race 차단. `auth.uid() = user_id` 강제 |
| `commit_chat_idempotency_key(key, user_id, snapshot)` | UUID, user_id, JSONB | `{committed, snapshot_stored}` | status='processing'에서만 'committed'로 전이. 128KB 초과 시 snapshot=null |
| `mark_chat_idempotency_failed(key, user_id)` | UUID, user_id | VOID | status='processing'에서만 'failed'로 전이. 재시도 허용 |

**보안**: 세 함수 모두 `SECURITY DEFINER` + `IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION`.

**Quota RPC와의 결합 여부**: **분리 권고** (이유: 기존 RPC 공유 사용, replay 케이스에서 quota 차감 우회 필요).

---

## 5. `/api/chat` 처리 의사코드

```
1. Body parse + auth (기존 유지)
2. Flag ON이면:
     ├─ Idempotency-Key 헤더 필수 확인 (없으면 400)
     ├─ request_hash = SHA-256(정렬된 JSON body)
     └─ reserve RPC 호출
        ├─ 'conflict'   → 409
        ├─ 'processing' → 202 Retry-After: 3
        ├─ 'replay'     → snapshot 스트림 재생
        └─ 'proceed'    → 다음 단계로
3. Quota 차감 RPC (기존 유지)
     실패 시 mark_failed 후 429 반환
4. ReadableStream:
     ├─ RAG + LLM 스트리밍 (기존)
     ├─ saveMessageWithRetry (기존)
     ├─ commit RPC (controller.close() 직전, await 보장)
     └─ catch: mark_failed (fire-and-forget)
```

---

## 6. Feature Flag

```ts
// featureFlags.ts
ENABLE_CHAT_IDEMPOTENCY: process.env.ENABLE_CHAT_IDEMPOTENCY === 'true',  // 서버
// 클라이언트
NEXT_PUBLIC_ENABLE_CHAT_IDEMPOTENCY: process.env.NEXT_PUBLIC_ENABLE_CHAT_IDEMPOTENCY === 'true',
```

기본 OFF. Vercel 환경 변수로 ON/OFF 즉시 전환 (서버 측은 재배포 불필요).

---

## 7. 위험과 완화책

| # | 위험 | 완화 |
|---|---|---|
| 1 | `processing` 고착 (60초 함수 타임아웃) | reserve RPC에서 `updated_at < NOW() - 5min` 인 processing 자동 reset + cleanup cron |
| 2 | snapshot commit 지연 → 응답 close 후 비동기 작업 손실 | commit을 `controller.close()` **이전**에 await |
| 3 | 다중 탭 동일 질문 (다른 키) | 옵션 C 범위 밖. 월간 quota로 시스템적 제한. 필요 시 request_hash 5초 윈도우 dedup 별도 추가 |

---

## 8. 단계별 실행 순서

| Phase | 작업 | 예상 소요 | 사용자 승인 |
|---|---|---|---|
| **0** | 본 설계 문서 ✅ | — | — |
| **1** | 마이그레이션 3종 작성 + `supabase db push` | 0.5일 | **필요** |
| **2** | `featureFlags.ts` + `idempotency.ts` 헬퍼 + 단위 테스트 | 1일 | 필요 |
| **3** | `/api/chat/route.ts` 통합 + 회귀 테스트 (flag OFF) | 1일 | 필요 |
| **4** | `useChat.ts` 클라이언트 연동 + 통합 테스트 | 1일 | 필요 |
| **5** | 스테이징 2주 모니터링 → 프로덕션 환경변수 투입 | 2주 | 필요 |

총 4~5일 작업 + 2주 모니터링.

---

## 9. 본 설계 적용 여부 결정 옵션

사용자께서 다음 중 선택하시기 바랍니다:

- **옵션 P0-A**: 본 설계만 보존하고 추후 별도 세션에서 Phase 1부터 진행
- **옵션 P0-B**: 본 설계 기반으로 Phase 1 (마이그레이션 작성)을 본 세션에서 즉시 진행
- **옵션 P0-C**: 설계 일부를 수정 (예: TTL 24h → 7d, snapshot 크기 제한 변경 등) 후 Phase 1 진행

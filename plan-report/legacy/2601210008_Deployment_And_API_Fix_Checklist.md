# 구현 체크리스트: 배포 및 OpenAI API 오류 수정

## [Phase 1: Vercel 배포 오류 수정]

**Before Start:**

- ⚠️ 주의: API 라우트의 강제 동적 처리(`force-dynamic`)는 캐싱을 무력화하므로, 배포 후 성능 모니터링이 필요할 수 있습니다.

**Implementation Items:**

- [ ] **ID(P1-01)**: [API-Categories] 동적 렌더링 강제 적용
  - `Target`: `src/app/api/categories/unique/route.ts`
  - `Logic (Pseudo)`:
    > export const dynamic = 'force-dynamic'; // Add to top level
  - `Key Variables`: `dynamic`
  - `Safety`: 없음 (설정 값 변경)

- [ ] **ID(P1-02)**: [API-Documents] 동적 렌더링 강제 적용
  - `Target`: `src/app/api/documents/list/route.ts`
  - `Logic (Pseudo)`:
    > export const dynamic = 'force-dynamic'; // Add to top level
  - `Key Variables`: `dynamic`
  - `Safety`: 없음 (설정 값 변경)

**Definition of Done (검증):**

- [ ] Test: `npm run build` 실행 시 `Dynamic server usage` 에러 없이 빌드 성공 확인
- [ ] Review: 빌드 로그에서 해당 라우트가 `λ (Server)` 또는 `Dynamic`으로 표시되는지 확인

## [Phase 2: OpenAI API 호환성 수정 (Fallback 안전장치 강화)]

**Before Start:**

- ⚠️ 주의: `models.ts`의 `MODEL_REGISTRY`가 최신 상태인지 확인하십시오. (특히 `reasoning` capability 포함 여부)

**Implementation Items:**

- [ ] **ID(P2-01)**: [OpenAI-Provider] 모델 기능 기반 파라미터 분기 처리
  - `Target`: `src/lib/llm/providers/openai.ts` > `generateText()`, `generateStream()`
  - `Logic (Pseudo)`:
    > const config = getModelConfig(modelId);
    > const hasReasoningCap = config?.capabilities.includes('reasoning') || config?.capabilities.includes('thinking');
    > const isLegacyO1 = modelId.startsWith('o1') || modelId.startsWith('o3'); // Safety
    > const useCompletionTokens = hasReasoningCap || isLegacyO1;
    >
    > if (useCompletionTokens) set param 'max_completion_tokens'
    > else set param 'max_tokens'
  - `Key Variables`: `modelId`, `config`, `capabilities`, `max_completion_tokens`
  - `Safety`: `getModelConfig`가 undefined일 경우를 대비해 `isLegacyO1` 로직을 OR 조건으로 유지 (하위 호환성)

**Definition of Done (검증):**

- [ ] Test: `gpt-5` 계열(추론 모델) 호출 시 `max_tokens` 에러가 발생하지 않아야 함
- [ ] Test: `gpt-4o` 등 일반 모델 호출 시 기존대로 `max_tokens`가 정상 작동해야 함
- [ ] Review: 불필요한 콘솔 로그(`Legacy logic used...` 등)가 있다면 제거

## [Phase 3: 최종 배포 검증]

**Before Start:**

- ⚠️ 주의: 실제 프로덕션 배포 전 로컬 빌드 테스트 필수

**Implementation Items:**

- [ ] **ID(P3-01)**: [Build & Deploy] 빌드 및 배포 수행
  - `Target`: Terminal
  - `Logic (Pseudo)`:
    > npm run build
    > if success -> vercel deploy --prod (or git push)
  - `Key Variables`: N/A
  - `Safety`: 빌드 실패 시 에러 로그 캡처

**Definition of Done (검증):**

- [ ] Test: Vercel 대시보드에서 배포 성공 확인 (Status: Ready)
- [ ] Test: 배포된 사이트에서 AI 채팅 기능(특히 Gemini 실패 시 백업 동작) 정상 작동 확인

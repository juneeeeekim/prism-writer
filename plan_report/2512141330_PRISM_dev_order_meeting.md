# 💎 PRISM 웹서비스 개발 순서 회의록

**회의 일자:** 2025-12-14  
**참석자:** System Architect, Backend Engineer, Database Engineer, AI/ML Engineer, DevOps Engineer, Frontend Engineer, Security Engineer  
**회의 주제:** PRISM 멀티모달 RAG 웹서비스 개발 프로세스 순서 결정

---

## 1. 문서 분석 요약

### 1.1 분석 대상 문서
1. **프리즘lm초안.md** - 프로젝트 기본 설계 및 Phase 1~4 로드맵
2. **프리즘lm_gpt52업글.md** - 실행 가능한 청사진 통합본
3. **프리즘lm_클로드업글.md** - 기술 회의록 및 상세 구현 제안
4. **프리즘lm_그록업글.md** - 업그레이드 아이디어 및 최신 트렌드 반영

### 1.2 핵심 합의 사항
| 항목 | 내용 |
|------|------|
| **개발 원칙** | TDD, Clean Architecture, Model Agnostic, Zero Cost |
| **아키텍처** | Hexagonal (Ports & Adapters), DI, Strategy Pattern |
| **기술 스택** | Python 3.11+ / FastAPI / Next.js / Supabase (pgvector) |
| **배포 전략** | Docker + Render (Backend) / Vercel (Frontend) |
| **비용 목표** | 무료 티어 최대 활용 (Zero Cost MVP) |

### 1.3 MVP 필수 기능
- 파일 업로드 (텍스트/PDF/이미지)
- 인제스트 파이프라인 (파싱 → 청킹 → 임베딩 → 인덱싱)
- Hybrid Search (벡터 + 텍스트)
- 근거 기반 답변 생성 (Streaming)
- 채팅 UI + 근거 카드
- 보안 최소세트 (Auth + RLS + 업로드 검증)
- 운영 최소세트 (/health, request_id, 비용 로깅)

---

## 2. 개발자별 순서 제안

### 2.1 🏗️ System Architect 제안

**제안명: "Foundation First" (기반 우선 접근법)**

```
Phase 1: 아키텍처 기반 (2주)
├── Clean Architecture 폴더 구조 생성
├── Domain 엔티티 정의 (Document, Chunk, ChatSession)
├── Port/Adapter 인터페이스 설계
└── DI 컨테이너 설정

Phase 2: 핵심 파이프라인 (3주)
├── 인제스트 파이프라인 구현
├── 검색 파이프라인 구현
└── LLM 통합 (Strategy Pattern)

Phase 3: 통합 및 UI (2주)
├── API 엔드포인트 구현
├── Frontend 연동
└── E2E 테스트

Phase 4: 보안 및 배포 (2주)
├── 보안 강화
├── CI/CD 구축
└── 프로덕션 배포
```

**근거:** 견고한 아키텍처 기반 위에 기능을 쌓아야 장기적 유지보수가 용이함

---

### 2.2 ⚙️ Backend Engineer 제안

**제안명: "Vertical Slice" (수직 슬라이스 접근법)**

```
Phase 1: 최소 동작 버전 (2주)
├── 단일 파일 업로드 → 저장 → 검색 → 답변 E2E
├── 기본 API 엔드포인트 (/upload, /search, /chat)
└── Health Check 구현

Phase 2: 기능 확장 (3주)
├── 멀티 파일 지원
├── Hybrid Search 구현
├── Streaming 응답
└── Rate Limiting

Phase 3: 안정화 (2주)
├── 에러 핸들링 강화
├── 비동기 작업 큐 (Celery)
└── 캐싱 레이어

Phase 4: 배포 (2주)
├── Docker 컨테이너화
├── CI/CD 파이프라인
└── 모니터링 설정
```

**근거:** 빠른 피드백 루프로 실제 동작하는 시스템을 먼저 확보

---

### 2.3 🗄️ Database Engineer 제안

**제안명: "Data Foundation" (데이터 기반 접근법)**

```
Phase 1: 스키마 및 인프라 (1주)
├── Supabase 프로젝트 설정
├── pgvector 익스텐션 활성화
├── 테이블 생성 (documents, chunks, ingestion_jobs, audit_logs)
└── HNSW 인덱스 설정

Phase 2: 검색 기능 (2주)
├── match_documents RPC 구현
├── Hybrid Search 함수 구현
├── FTS 인덱스 설정
└── 성능 테스트

Phase 3: 백엔드 연동 (3주)
├── Repository 패턴 구현
├── API 개발
└── 프론트엔드 연동

Phase 4: 운영 준비 (2주)
├── 파티셔닝 전략
├── 백업/복구 스크립트
├── 아카이빙 정책
└── 보안 (RLS)
```

**근거:** 데이터 계층이 안정적이어야 상위 레이어 개발이 원활함

---

### 2.4 🤖 AI/ML Engineer 제안

**제안명: "RAG Pipeline First" (RAG 파이프라인 우선)**

```
Phase 1: 임베딩 파이프라인 (2주)
├── 텍스트 파싱 (PDF, TXT)
├── 청킹 전략 구현 (Semantic Chunking)
├── 임베딩 생성 (OpenAI text-embedding-3)
└── 벡터 저장

Phase 2: 검색 최적화 (2주)
├── Vector Search 구현
├── Hybrid Search (BM25 + Vector)
├── Reranking 파이프라인
└── 평가셋 구축 (20~50 Q/A)

Phase 3: 답변 생성 (2주)
├── LLM Provider 추상화
├── Prompt Engineering
├── 근거 인용 시스템
└── Streaming 구현

Phase 4: 멀티모달 확장 (2주)
├── 이미지 → Caption (Vision LM)
├── 테이블 파싱
└── 품질 평가 및 튜닝
```

**근거:** RAG 품질이 서비스의 핵심 가치이므로 AI 파이프라인 우선 검증 필요

---

### 2.5 🚀 DevOps Engineer 제안

**제안명: "Infrastructure as Code" (인프라 우선)**

```
Phase 1: 개발 환경 구축 (1주)
├── Docker 개발 환경 설정
├── docker-compose.dev.yml
├── 환경변수 관리 (.env.example)
└── 로컬 테스트 환경

Phase 2: CI/CD 파이프라인 (1주)
├── GitHub Actions 워크플로우
├── 테스트 자동화
├── 코드 품질 검사 (ruff, black)
└── 취약점 스캔

Phase 3: 기능 개발 지원 (4주)
├── 개발팀 인프라 지원
├── 스테이징 환경 구축
└── 모니터링 기초 (Sentry)

Phase 4: 프로덕션 배포 (2주)
├── Render 배포 설정
├── Vercel 배포 설정
├── Blue-Green 배포
├── 백업 자동화
└── 알림 설정
```

**근거:** 인프라가 준비되어야 개발팀이 효율적으로 작업 가능

---

### 2.6 🎨 Frontend Engineer 제안

**제안명: "UI/UX Driven" (사용자 경험 중심)**

```
Phase 1: 디자인 시스템 (1주)
├── Next.js 프로젝트 설정
├── Tailwind CSS 설정
├── 공통 컴포넌트 (Button, Input, Card)
└── 테마 시스템 (Light/Dark)

Phase 2: 핵심 UI (3주)
├── 파일 업로드 (DragDropZone)
├── 채팅 인터페이스 (MessageList)
├── 근거 카드 (SourceCard)
└── 실시간 스트리밍

Phase 3: 백엔드 연동 (2주)
├── API 클라이언트 구현
├── 상태 관리 (Zustand)
├── React Query 캐싱
└── 에러 핸들링 UI

Phase 4: 최적화 및 배포 (2주)
├── 성능 최적화
├── 접근성 (a11y)
├── Vercel 배포
└── PWA 지원 (선택)
```

**근거:** 사용자 피드백을 빠르게 받아 제품 방향 검증 필요

---

### 2.7 🔒 Security Engineer 제안

**제안명: "Security by Design" (보안 내재화)**

```
Phase 1: 보안 기반 (1주)
├── Supabase Auth 설정
├── JWT 토큰 검증
├── RBAC 권한 체계
└── RLS 정책 설정

Phase 2: 입력 검증 (2주)
├── 파일 업로드 보안 (MIME, 크기, 해시)
├── SQL Injection 방지
├── XSS 방지
└── CORS 정책

Phase 3: 기능 개발 지원 (3주)
├── 보안 코드 리뷰
├── API Key 암호화 (KeyManager)
└── PII 마스킹

Phase 4: 감사 및 컴플라이언스 (2주)
├── Audit Log 구현
├── GDPR 준수 (데이터 삭제/내보내기)
├── 보안 헤더 설정
└── 취약점 스캔 자동화
```

**근거:** 보안은 나중에 추가하기 어려우므로 처음부터 내재화 필요

---

## 3. 투표 결과

### 3.1 투표 방식
각 개발자가 1순위(3점), 2순위(2점), 3순위(1점) 선택

### 3.2 투표 내역

| 투표자 | 1순위 (3점) | 2순위 (2점) | 3순위 (1점) |
|--------|-------------|-------------|-------------|
| System Architect | Foundation First | Data Foundation | RAG Pipeline First |
| Backend Engineer | Vertical Slice | RAG Pipeline First | Foundation First |
| Database Engineer | Data Foundation | Foundation First | Vertical Slice |
| AI/ML Engineer | RAG Pipeline First | Vertical Slice | Data Foundation |
| DevOps Engineer | Infrastructure as Code | Vertical Slice | Foundation First |
| Frontend Engineer | UI/UX Driven | Vertical Slice | RAG Pipeline First |
| Security Engineer | Security by Design | Foundation First | Data Foundation |

### 3.3 최종 점수

| 순위 | 제안명 | 점수 | 비고 |
|------|--------|------|------|
| 🥇 1위 | **Vertical Slice** | 9점 | 2순위 4표 + 3순위 1표 |
| 🥈 2위 | **Foundation First** | 8점 | 1순위 1표 + 2순위 2표 + 3순위 1표 |
| 🥉 3위 | **Data Foundation** | 7점 | 1순위 1표 + 2순위 1표 + 3순위 2표 |
| 4위 | RAG Pipeline First | 7점 | 1순위 1표 + 2순위 1표 + 3순위 2표 |
| 5위 | Infrastructure as Code | 3점 | 1순위 1표 |
| 6위 | Security by Design | 3점 | 1순위 1표 |
| 7위 | UI/UX Driven | 3점 | 1순위 1표 |

---

## 4. 최종 결정: 하이브리드 접근법

### 4.1 채택 전략
투표 결과를 바탕으로 **"Vertical Slice + Foundation First + Security by Design"** 하이브리드 접근법 채택

### 4.2 최종 개발 순서


```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRISM 개발 로드맵 (총 9주)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: 기반 구축 (Week 1-2)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [인프라] Supabase 설정 + pgvector + 기본 스키마                      │   │
│  │ [아키텍처] Clean Architecture 폴더 구조 + Domain 엔티티              │   │
│  │ [보안] Supabase Auth + RLS + 환경변수 관리                          │   │
│  │ [DevOps] Docker 개발환경 + CI/CD 기초                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  Phase 2: 핵심 E2E 구현 (Week 3-5)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [Backend] 업로드 → 파싱 → 청킹 → 임베딩 → 저장 파이프라인           │   │
│  │ [AI/ML] 벡터 검색 + Hybrid Search + 기본 답변 생성                  │   │
│  │ [Frontend] 파일 업로드 UI + 채팅 인터페이스 + 근거 카드             │   │
│  │ [보안] 파일 업로드 검증 + API 인증                                  │   │
│  │ ★ 마일스톤: 단일 파일 업로드 → 질문 → 근거 기반 답변 E2E 동작      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  Phase 3: 기능 확장 및 안정화 (Week 6-7)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [Backend] Streaming 응답 + Rate Limiting + 비동기 큐               │   │
│  │ [AI/ML] Reranking + 평가셋 구축 (20~50 Q/A) + 품질 튜닝            │   │
│  │ [Database] HNSW 인덱스 최적화 + 캐싱 레이어                        │   │
│  │ [Frontend] 실시간 스트리밍 + 업로드 진행률 + 에러 핸들링           │   │
│  │ ★ 마일스톤: 검색 정확도 80%+ / 응답 시간 2초 이내                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  Phase 4: 프로덕션 준비 (Week 8-9)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [DevOps] Render/Vercel 배포 + Blue-Green + 백업 자동화             │   │
│  │ [보안] Audit Log + 보안 헤더 + 취약점 스캔                         │   │
│  │ [모니터링] Sentry + Health Check + 비용 로깅                       │   │
│  │ [문서화] API 문서 + 사용자 가이드 + 운영 매뉴얼                    │   │
│  │ ★ 마일스톤: 가동률 99.5%+ / 배포 시간 10분 이내                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 상세 실행 계획

### Phase 1: 기반 구축 (Week 1-2)

#### Week 1: 인프라 및 아키텍처
| 담당 | 작업 | 산출물 |
|------|------|--------|
| DevOps | Docker 개발환경 구축 | docker-compose.dev.yml |
| DevOps | GitHub Actions 기초 설정 | .github/workflows/ci.yml |
| Database | Supabase 프로젝트 생성 | 프로젝트 URL, API Key |
| Database | pgvector 활성화 + 기본 테이블 | SQL 스크립트 |
| System Architect | Clean Architecture 폴더 구조 | 디렉토리 구조 |
| System Architect | Domain 엔티티 정의 | entities/*.py |

#### Week 2: 보안 기반 및 연결 테스트
| 담당 | 작업 | 산출물 |
|------|------|--------|
| Security | Supabase Auth 설정 | auth 설정 |
| Security | RLS 정책 설정 | SQL 정책 |
| Security | 환경변수 관리 | .env.example |
| Backend | Supabase 연결 테스트 | test_supabase_connection.py |
| Backend | Health Check 엔드포인트 | /health API |
| Frontend | Next.js 프로젝트 초기화 | 프로젝트 구조 |

**Phase 1 완료 기준:**
- [ ] Supabase 연결 테스트 통과
- [ ] 더미 벡터 데이터 저장/조회 성공
- [ ] Health Check 정상 응답
- [ ] Auth 토큰 검증 동작

---

### Phase 2: 핵심 E2E 구현 (Week 3-5)

#### Week 3: 인제스트 파이프라인
| 담당 | 작업 | 산출물 |
|------|------|--------|
| Backend | 파일 업로드 API | POST /v1/files |
| AI/ML | 텍스트 파싱 (TXT, PDF) | parsers/*.py |
| AI/ML | 청킹 로직 구현 | chunker.py |
| AI/ML | 임베딩 생성 (OpenAI) | embedder.py |
| Database | chunks 테이블 저장 | repository 구현 |
| Security | 파일 업로드 검증 | file_validator.py |

#### Week 4: 검색 및 답변
| 담당 | 작업 | 산출물 |
|------|------|--------|
| Database | match_documents RPC | SQL 함수 |
| AI/ML | Vector Search 구현 | retriever.py |
| AI/ML | LLM Provider 추상화 | llm_provider.py |
| AI/ML | 근거 인용 답변 생성 | generator.py |
| Backend | 검색 API | POST /v1/search |
| Backend | 채팅 API | POST /v1/chat |

#### Week 5: 프론트엔드 연동
| 담당 | 작업 | 산출물 |
|------|------|--------|
| Frontend | 파일 업로드 UI | DragDropZone.tsx |
| Frontend | 채팅 인터페이스 | ChatInterface.tsx |
| Frontend | 근거 카드 컴포넌트 | SourceCard.tsx |
| Frontend | API 클라이언트 | api-client.ts |
| Backend | CORS 설정 | middleware 설정 |
| All | E2E 통합 테스트 | 테스트 결과 |

**Phase 2 완료 기준:**
- [ ] 파일 업로드 → 인제스트 → 검색 → 답변 E2E 동작
- [ ] 근거 카드에 출처 표시
- [ ] 기본 인증 동작

---

### Phase 3: 기능 확장 및 안정화 (Week 6-7)

#### Week 6: 성능 최적화
| 담당 | 작업 | 산출물 |
|------|------|--------|
| Database | HNSW 인덱스 적용 | 인덱스 생성 |
| Database | Hybrid Search 함수 | hybrid_search RPC |
| AI/ML | Reranking 파이프라인 | reranker.py |
| AI/ML | 평가셋 구축 | evaluation_set.json |
| Backend | Streaming 응답 구현 | SSE 엔드포인트 |
| Backend | Rate Limiting | slowapi 설정 |

#### Week 7: 안정화
| 담당 | 작업 | 산출물 |
|------|------|--------|
| Backend | 비동기 작업 큐 | Celery 설정 |
| Backend | 에러 핸들링 강화 | exception handlers |
| Frontend | 실시간 스트리밍 UI | useStreamingChat.ts |
| Frontend | 업로드 진행률 | useUploadProgress.ts |
| AI/ML | 품질 평가 및 튜닝 | 평가 리포트 |
| Database | 캐싱 레이어 | Redis 설정 |

**Phase 3 완료 기준:**
- [ ] 검색 정확도 80% 이상
- [ ] 응답 시간 2초 이내 (캐시 미적중)
- [ ] Streaming 응답 동작
- [ ] 동시 사용자 50명 처리

---

### Phase 4: 프로덕션 준비 (Week 8-9)

#### Week 8: 배포 및 모니터링
| 담당 | 작업 | 산출물 |
|------|------|--------|
| DevOps | Render 배포 설정 | render.yaml |
| DevOps | Vercel 배포 설정 | vercel.json |
| DevOps | Blue-Green 배포 | 배포 스크립트 |
| DevOps | Sentry 통합 | 모니터링 설정 |
| DevOps | 백업 자동화 | backup.sh |
| Security | Audit Log 구현 | audit_logs 테이블 |

#### Week 9: 문서화 및 최종 점검
| 담당 | 작업 | 산출물 |
|------|------|--------|
| All | API 문서 작성 | OpenAPI 스펙 |
| All | 사용자 가이드 | docs/user-guide.md |
| All | 운영 매뉴얼 | docs/operations.md |
| Security | 보안 헤더 설정 | middleware |
| Security | 취약점 스캔 | 스캔 리포트 |
| All | 최종 E2E 테스트 | 테스트 결과 |

**Phase 4 완료 기준:**
- [ ] 프로덕션 배포 완료
- [ ] 가동률 99.5% 이상
- [ ] 배포 시간 10분 이내
- [ ] 백업 복구 테스트 통과
- [ ] 문서화 완료

---

## 6. 역할별 책임 매트릭스 (RACI)

| 작업 영역 | Architect | Backend | Database | AI/ML | DevOps | Frontend | Security |
|-----------|:---------:|:-------:|:--------:|:-----:|:------:|:--------:|:--------:|
| 아키텍처 설계 | **R** | C | C | C | I | I | C |
| API 개발 | C | **R** | C | C | I | C | C |
| DB 스키마 | C | C | **R** | C | I | I | C |
| RAG 파이프라인 | C | C | C | **R** | I | I | I |
| CI/CD | I | C | I | I | **R** | C | C |
| UI 개발 | I | C | I | I | I | **R** | I |
| 보안 | C | C | C | I | C | C | **R** |

**R**: Responsible (실행), **A**: Accountable (책임), **C**: Consulted (협의), **I**: Informed (통보)

---

## 7. 리스크 및 대응 방안

| 리스크 | 영향도 | 발생 확률 | 대응 방안 |
|--------|--------|----------|----------|
| 무료 티어 한도 초과 | 높음 | 중간 | 사용량 모니터링 + 알림 설정 |
| LLM API 비용 폭주 | 높음 | 중간 | Rate Limiting + 사용자별 한도 |
| 검색 품질 미달 | 높음 | 중간 | 평가셋 기반 지속 튜닝 |
| 보안 취약점 | 높음 | 낮음 | 자동 스캔 + 코드 리뷰 |
| 일정 지연 | 중간 | 중간 | 주간 스프린트 리뷰 + 버퍼 |

---

## 8. 회의 결론

### 8.1 합의 사항
1. **하이브리드 접근법 채택**: Vertical Slice 기반 + Foundation First 원칙 + Security by Design
2. **총 개발 기간**: 9주 (Phase 1~4)
3. **MVP 우선**: 고급 기능(멀티모달 고도화, GraphRAG 등)은 MVP 이후 Phase 5+로 연기
4. **Zero Cost 유지**: 무료 티어 한도 내 운영, 초과 시 유료 전환 검토

### 8.2 다음 단계
1. [ ] Phase 1 상세 태스크 분해 (담당자별)
2. [ ] GitHub 프로젝트 보드 생성
3. [ ] 주간 스프린트 미팅 일정 확정
4. [ ] 개발 환경 셋업 가이드 작성

---

**회의록 작성:** Senior Developer  
**승인:** 전원 합의  
**다음 회의:** Phase 1 킥오프 미팅

# PRISM 프로젝트 업그레이드 아이디어 회의록

**회의 일자:** 2025-12-14  
**참석자 (가상):** Senior Developer (진행), System Architect, Backend Engineer, Database Engineer, AI/ML Engineer, DevOps Engineer, Frontend Engineer, Security Engineer  
**작성자:** Grok (문서 분석 및 팀 아이디어 통합)

## 1. 프로젝트 문서 종합 분석 요약

첨부된 세 문서(초안, GPT 업글 청사진, Claude 업글 회의록)를 분석한 결과, PRISM 프로젝트는 **멀티모달 RAG 웹서비스**를 목표로 하는 훌륭한 기반을 갖추고 있습니다.

**강점:**

- Clean Architecture + Hexagonal + TDD 원칙 철저 준수
- Zero Cost 운영 전략 (Supabase, Render/Vercel 무료 티어 활용)
- Model Agnostic 설계 (Strategy Pattern으로 LLM 스위칭)
- 멀티모달 방향성 명확 (이미지 → VLM Caption → 임베딩)
- 보안/관측/평가 최소세트 포함 계획
- 단계적 로드맵 (Phase 1~4)으로 리스크 최소화

**현재 한계/개선 여지:**

- MVP 중심으로 Advanced RAG 기법 미적용 (e.g., Reranking, Adaptive RAG)
- 캐싱/비동기 큐 (Redis/Celery) 도입 제안되었으나 Zero Cost와 충돌 가능
- 멀티모달 고도화가 Phase 4로 미뤄짐
- Hybrid Search 기본 구현이지만 최신 최적화 부족
- 보안이 최소세트지만, 파일 업로드/PII 처리 강화 필요

전체적으로 **MVP 완성 후 빠른迭代**가 가능한 탄탄한 청사진입니다. 이제 각 역할별 업그레이드 아이디어를 brainstorm합니다.

## 2. System Architect - 아키텍처 업그레이드 아이디어

현재 Hexagonal + DI + Strategy가 훌륭하나, 장기 확장성을 위해:

- **Modular RAG 도입**: RAG 파이프라인을 Pre-retrieval (Query Transformation), Retrieval, Post-retrieval (Reranking), Generation으로 모듈화. LangChain/LlamaIndex 활용으로 쉽게 구현 가능.
- **Adaptive RAG 고려**: 쿼리 복잡도에 따라 Retrieval 여부/깊이 동적 조정 (e.g., 간단 쿼리는 LLM 직접 답변 → 비용/지연 절감).
- **GraphRAG 기본 준비**: 엔티티/관계 추출 후 Knowledge Graph 구축 (Neo4j 무료 티어 or Supabase JSONB로 시작). 복잡 쿼리에서 우수한 성능.

## 3. Backend Engineer - 구현 업그레이드 아이디어

FastAPI 중심으로 좋으나:

- **비동기 Ingestion 강화**: 업로드 즉시 응답 후 Background Task (FastAPI BackgroundTasks or Celery)로 파싱/임베딩 처리 → UX 개선.
- **Rate Limiting 필수**: slowapi로 사용자별/전체 제한 → 비용 폭주 방지.
- **Caching 최소화**: Redis 대신 Supabase Edge Functions 내 in-memory cache or 간단 dict (단일 인스턴스 가정) → Zero Cost 유지. 필요 시 Dragonfly (Redis 호환 무료 대안) 고려.

## 4. Database Engineer - 데이터 계층 업그레이드 아이디어

Supabase + pgvector 조합 최적:

- **HNSW 인덱스 즉시 적용**: 대규모 데이터에서도 빠른 검색 (CREATE INDEX ... USING hnsw).
- **Hybrid Search 고도화**: 기존 RPC에 BM25 (pg_trgm or full-text search) 결합 + rerank 단계 추가.
- **테이블 분리 강화**: documents (메타), chunks (청크+embedding), ingestion_jobs, audit_logs 명확히.
- **파티셔닝/아카이빙**: 초반부터 created_at 기반 파티션 준비 → 장기 운영 안정.

## 5. AI/ML Engineer - RAG 및 멀티모달 업그레이드 아이디어

현재 Caption 기반 멀티모달 좋으나:

- **Direct Multimodal Embedding**: 이미지 캡션 대신 CLIP-like 모델 (open-source)로 직접 이미지 임베딩 → 시각 정보 보존 향상 (2025 트렌드).
- **Advanced RAG 기법 도입**:
  - Query Decomposition/Rewriting (복잡 쿼리 분해)
  - Cohere Rerank (무료 티어) or Cross-Encoder reranking
  - Self-RAG (LLM 자체 Reflection으로 Retrieval 판단)
- **Smart Chunking**: 의미 기반 (Semantic Chunking) + 문서 타입별 전략 (표/코드/이미지).
- **Prompt Manager 확장**: A/B 테스트 + 버전 관리.

## 6. DevOps Engineer - 배포/운영 업그레이드 아이디어

Zero Cost 유지 핵심:

- **Vercel Full Deployment**: Next.js + FastAPI (Vercel Serverless Functions) 통합 가능 → Render 대신 Vercel 단일 플랫폼.
- **CI/CD 강화**: GitHub Actions에 테스트/린트/취약점 스캔 (Dependabot) + 자동 배포.
- **Observability 최소세트**: Sentry 무료 티어 (에러) + Supabase Logs + Prometheus (간단 메트릭).
- **Backup**: Supabase 자동 백업 + pg_dump 크론 (Render Cron Jobs 무료).

## 7. Frontend Engineer - UI/UX 업그레이드 아이디어

Next.js 기반 좋음:

- **근거 하이라이트 고도화**: 청크 텍스트 하이라이트 + 이미지 썸네일/줌 지원.
- **실시간 피드백**: Ingestion 진행률 (SSE or WebSocket) + 채팅 스트리밍.
- **접근성/모바일**: Tailwind + Responsive + Dark Mode 기본.
- **오프라인 지원 고려**: PWA로 캐시된 문서 로컬 조회 (장기 목표).

## 8. Security Engineer - 보안 업그레이드 아이디어

최소세트 좋으나 강화 필수:

- **파일 업로드 철저 검증**: MIME 시그니처 + 크기 제한 + ClamAV (무료) 스캔 + 메타데이터 제거 (exiftool).
- **PII 처리**: 업로드/인제스트 시 자동 감지 & 마스킹 (Presidio or 규칙 기반).
- **RLS + RBAC 고도화**: Supabase Auth + Row Level Security로 사용자별 문서 격리.
- **Guardrails**: LLM 출력에 PII 마스킹 (Amazon Bedrock Guardrails 아이디어 차용 or 간단 프롬프트).

## 9. 종합 제안 및 다음 액션

**우선순위 업그레이드 (MVP 후 즉시 적용 추천):**

1. Hybrid Search + HNSW 인덱스
2. Reranking + Query Optimization
3. 파일 업로드 보안 강화 + PII 마스킹
4. Adaptive/Modular RAG 기반으로 파이프라인 리팩토링

**Zero Cost 유지 전략**: Redis 대신 in-memory or Dragonfly, 고비용 기능 (Rerank)은 옵션으로.

**다음 단계:**

- Phase 1 완료 후 위 아이디어 중 Top 3 투표
- ADR 문서 추가 (e.g., "Advanced RAG 도입", "Multimodal Embedding 전략")
- 평가셋 확대 (50→100 Q/A, Multimodal 포함)

PRISM은 이미 엔터프라이즈급 잠재력을 가진 프로젝트입니다. 위 업그레이드로 2025년 최신 트렌드(Adaptive/Graph/Multimodal RAG)를 선도할 수 있을 것입니다! 추가 논의 환영합니다. 🚀

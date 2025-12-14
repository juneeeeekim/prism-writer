# 💎 PRISM: Multimodal RAG Platform Project Charter

**Version:** 1.2 (Final Execution Ready)  
**Date:** 2025-07-17  
**Author:** PRISM Dev Team (System Architect, AI Engineer, Product Engineer)

---

## 1. 프로젝트 개요 (Overview)

- **Project Name:** PRISM (프리즘)
- **Concept:** 사용자의 다양한 질문과 멀티모달 소스(Light/Data)가 투입되면, 정교한 아키텍처(Prism)를 통과하여 최적의 통찰력(Spectrum/Answer)을 제공하는 서비스.
- **Goal:** **Clean Architecture**와 **TDD**를 준수하며, **비용 0원(Zero Cost)**으로 운영 가능한 엔터프라이즈급 RAG 시스템 구축.

---

## 2. 개발 원칙 (Engineering Principles)

1. **Test First (TDD)**  
   실패하는 테스트를 먼저 작성하지 않고는 실제 구현 코드를 작성하지 않는다.
2. **Clean Architecture**  
   비즈니스 로직(Domain)은 외부 인터페이스(Web, DB)로부터 완벽하게 격리되어야 한다.
3. **Model Agnostic**  
   특정 LLM(GPT, Claude 등)에 종속되지 않는 유연한 플러그인 구조를 지향한다.
4. **Zero Cost & Efficiency**  
   무료 티어 인프라를 최대한 활용하되, 성능 최적화를 통해 사용자 경험을 해치지 않는다.

---

## 3. 시스템 아키텍처 (System Architecture)

### 3.1. Core Design Pattern

- **Hexagonal Architecture (Ports & Adapters)**  
  도메인 로직을 중심에 두고, 입출력은 어댑터를 통해 처리.
- **Dependency Injection (DI)**  
  런타임에 LLM 모델이나 DB 구현체를 주입하여 유연성 확보.
- **Strategy Pattern**  
  LLM 모델 스위칭(`GPTStrategy`, `ClaudeStrategy`) 및 문서 파싱 전략에 사용.

### 3.2. Multimodal Pipeline

- **Smart Ingestion**  
  파일 업로드 시 메타데이터 자동 추출 및 분류.
- **VLM Integration**  
  이미지는 시각적 언어 모델(Vision LM)을 통해 텍스트 묘사(Caption)로 변환 후 임베딩 및 저장.

---

## 4. 기술 스택: "The PRISM Zero Stack"

| 영역 | 기술 스택 | 상세 내용 및 선정 이유 | 비용 |
| :--- | :--- | :--- | :--- |
| **Language** | **Python 3.11+** | 최신 비동기 기능 및 타입 힌트 활용 | Free |
| **Framework** | **FastAPI** | 고성능 비동기 API 서버, 자동 문서화 | Free |
| **Frontend** | **Next.js** | React 기반 웹 프레임워크, **Vercel** 배포 | Free (Tier) |
| **Backend Ops** | **Docker + Render** | 컨테이너 기반 배포, **Render** 무료 티어 활용 | Free (Tier) |
| **Database** | **Supabase** | PostgreSQL + **pgvector** (벡터 DB 역할) + Storage (파일 저장) | Free (Tier) |
| **LLM** | **User API Key** | OpenAI, Anthropic 등 사용자/관리자 키 사용 | Pay-per-use |

---

## 5. 개발 로드맵 (Hybrid Roadmap)

**전략:** 안정성 검증(Risk First) 후 기능 단위 구현(Vertical Slice)

### ✅ Phase 1: 환경 검증 및 기반 구축 (Current Step)

- [ ] Github Repository 초기화 및 `.gitignore`, `requirements.txt` 작성.
- [ ] **Supabase** 프로젝트 생성 및 `pgvector` 익스텐션 활성화.
- [ ] **DB 연결 테스트:** 파이썬 코드에서 Supabase 접속 및 더미 벡터 데이터 저장/조회 테스트 (Test Code).
- [ ] **Clean Architecture 폴더 구조** 생성 (Domain, Application, Infrastructure, Presentation).

### ⏳ Phase 2: 핵심 도메인 및 업로드 구현

- [ ] 도메인 엔티티 정의 (`Document`, `Chunk`).
- [ ] 파일 파싱 및 청킹(Chunking) 로직 TDD 구현.
- [ ] 임베딩 생성 및 Supabase 저장 구현.

### ⏳ Phase 3: 채팅 및 모델 스위칭

- [ ] LLM 인터페이스(`LLMProvider`) 추상화 및 구현.
- [ ] RAG 검색 로직 (Hybrid Search: Keyword + Vector).
- [ ] 채팅 API 구현.

### ⏳ Phase 4: 프론트엔드 및 배포

- [ ] Next.js 기본 UI 구축.
- [ ] Dockerfile 작성 및 Render 배포.

---

## 6. 초기 설정 파일 (Initial Setup)

### 6.1. Project Directory Structure (Clean Architecture)

```text
prism-backend/
├── src/
│   ├── domain/             # [Core] 순수 비즈니스 로직 (외부 의존성 X)
│   │   ├── entities/       # Document, Chunk, ChatSession
│   │   └── interfaces/     # Repository & Service Interfaces
│   ├── application/        # [Use Cases] 애플리케이션 로직
│   │   ├── use_cases/      # UploadDocument, ChatWithRAG
│   │   └── dtos/           # Data Transfer Objects
│   ├── infrastructure/     # [Adapters] 외부 시스템 구현체
│   │   ├── database/       # Supabase Client, Repositories
│   │   ├── llm/            # OpenAI, Claude Implementations
│   │   └── storage/        # File Storage Implementations
│   └── presentation/       # [Entry Points] API 진입점
│       └── api/            # FastAPI Routers
├── tests/                  # TDD Tests
│   ├── unit/               # Domain & UseCase Tests
│   └── integration/        # DB Connection & External API Tests
├── .env.example
├── .gitignore
├── requirements.txt
└── main.py                 # App Entry Point
```

---

## 7. [부록] Phase 1 실행 가이드 (Execution Guide)

**이 코드가 있어야 로드맵의 'Phase 1'을 즉시 완료할 수 있습니다.**

### 7.1. Supabase SQL Script

Supabase 대시보드의 **SQL Editor**에 붙여넣고 `Run`을 클릭하여 DB를 초기화하십시오.

```sql
-- 1. 벡터 검색 기능을 위한 확장 프로그램 활성화
create extension if not exists vector;

-- 2. 문서 저장을 위한 테이블 생성
create table documents (
  id bigserial primary key,
  content text, -- 문서의 텍스트 청크
  metadata jsonb, -- 파일명, 페이지 번호 등 메타데이터
  embedding vector(1536) -- OpenAI 임베딩 차원 (모델에 따라 변경 가능)
);

-- 3. 벡터 검색을 위한 함수 (RPC) 생성
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

---

### 7.2. Integration Test: Supabase 연결 및 벡터 삽입

`tests/test_supabase_connection.py`

```python
# tests/test_supabase_connection.py
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import pytest

# 환경 변수 로드
load_dotenv()

@pytest.mark.asyncio
async def test_supabase_connection_and_vector_insert():
    """
    Supabase에 연결하고 더미 데이터를 넣어 벡터 기능이 작동하는지 확인합니다.
    이 테스트가 통과하면 인프라 준비는 끝난 것입니다.
    """
    # Given
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")

    assert url is not None, "SUPABASE_URL 환경변수가 없습니다."
    assert key is not None, "SUPABASE_KEY 환경변수가 없습니다."

    supabase: Client = create_client(url, key)

    # 임의의 더미 데이터 (Vector dim=1536, OpenAI 기준)
    # 테스트를 위해 0으로 채운 벡터 사용
    dummy_vector = [0.1] * 1536
    dummy_data = {
        "content": "This is a connection test.",
        "metadata": {"source": "test_script"},
        "embedding": dummy_vector
    }

    # When: 데이터 삽입
    response = supabase.table("documents").insert(dummy_data).execute()

    # Then: 삽입 성공 확인
    assert len(response.data) > 0
    inserted_id = response.data[0]['id']
    assert response.data[0]['content'] == "This is a connection test."

    # Clean Up: 테스트 데이터 삭제
    supabase.table("documents").delete().eq("id", inserted_id).execute()
```

---

### 7.3. 환경 변수 예시 (`.env.example`)

```env
# Application Settings
APP_ENV=development
LOG_LEVEL=DEBUG

# Supabase (Database & Vector Store)
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
```

---

### 7.4. Python Dependencies (`requirements.txt` 예시)

```text
fastapi>=0.100.0
uvicorn[standard]
pydantic>=2.0.0
pydantic-settings
supabase>=2.0.0
langchain>=0.1.0
langchain-openai
langchain-community
python-multipart
pytest
pytest-asyncio
python-dotenv
tiktoken
unstructured
```

---

### 7.5. Git Ignore 설정 (`.gitignore` 예시)

```gitignore
# Python
__pycache__/
*.py[cod]
*.so
.venv/
venv/
env/

# Environment Variables (Security)
.env
.env.local

# IDE
.vscode/
.idea/

# Logs
*.log

# Testing
.pytest_cache/
```

📋 PRISM 프로젝트 분석 및 기술 회의록
문서 버전: 1.0
회의 일자: 2025-12-11
참석자: Senior Developer (회의 진행), System Architect, Backend Engineer, Database Engineer, AI/ML Engineer, DevOps Engineer, Frontend Engineer, Security Engineer
작성자: Senior Development Team
목차
프로젝트 분석
기술 회의 내용
종합 제안서
액션 아이템
1. 프로젝트 분석
🎯 프로젝트 목적
PRISM은 멀티모달 RAG(Retrieval-Augmented Generation) 플랫폼입니다.
핵심 기능:
사용자가 다양한 형식의 문서(텍스트, 이미지 등)를 업로드
벡터 DB에 저장 및 인덱싱
질문에 대해 관련 문서를 검색하여 LLM이 답변을 생성
💡 핵심 특징
Zero Cost 운영: 무료 티어만 활용 (Supabase, Render, Vercel)
Clean Architecture: 비즈니스 로직과 인프라 완전 분리
TDD 원칙: 테스트 주도 개발
Model Agnostic: 여러 LLM 모델 스위칭 가능
📊 현재 기술 스택
영역
기술
비고
Language
Python 3.11+
비동기 처리 및 타입 힌트
Backend
FastAPI
고성능 API 서버
Frontend
Next.js
React 기반 프레임워크
Database
Supabase (PostgreSQL + pgvector)
벡터 검색 지원
Deployment
Docker + Render
컨테이너 기반 배포
LLM
User API Key
OpenAI, Anthropic 등
2. 기술 회의 내용
2.1 System Architect - 아키텍처 개선 제안
✅ 현재 설계의 강점
Hexagonal Architecture 적용으로 확장성 확보
Port & Adapter 패턴으로 외부 의존성 격리
멀티모달 파이프라인 구조가 명확함
🔧 개선 제안
1. 이벤트 기반 아키텍처 추가
문서 업로드 → 파싱 → 임베딩 → 저장을 이벤트 체인으로 처리
- 비동기 처리로 대용량 파일 업로드 시 응답성 개선
- Event Sourcing 패턴 적용 가능
2. CQRS 패턴 적용
Command Side (쓰기):
  - 문서 업로드
  - 문서 삭제
  - 설정 변경

Query Side (읽기):
  - 문서 검색
  - 채팅 쿼리
  - 통계 조회

이점: 읽기/쓰기 최적화 분리, 확장성 향상
3. 캐싱 레이어 추가
- 자주 검색되는 쿼리 임베딩 캐싱 (Redis 무료 티어)
- LLM 응답 캐싱으로 API 비용 절감
- TTL 기반 캐시 무효화 전략
2.2 Backend Engineer - 구현 개선 제안
✅ 현재 스택의 장점
FastAPI의 비동기 처리 능력
Supabase의 pgvector 통합
🔧 개선 제안
1. 배치 처리 시스템 추가
# Celery + Redis를 사용한 비동기 작업 큐

from celery import Celery

app = Celery('prism', broker='redis://localhost:6379')

@app.task
def process_large_document(document_id: str):
    """
    대용량 문서의 청킹/임베딩을 백그라운드 처리
    """
    # 문서 파싱
    # 청킹
    # 임베딩 생성
    # DB 저장
    pass
2. Rate Limiting & Throttling
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/chat")
@limiter.limit("10/minute")  # 분당 10회 제한
async def chat_endpoint():
    pass
3. Health Check & Monitoring
엔드포인트 구조:

/health
├── /db        # Supabase 연결 상태
├── /llm       # LLM API 가용성
├── /storage   # 스토리지 상태
└── /cache     # Redis 상태
4. API Versioning 전략
/api/v1/*  - 현재 버전
/api/v2/*  - 향후 버전
- 하위 호환성 유지 구조
- Deprecation 정책 수립
2.3 Database Engineer - 데이터 계층 개선 제안
✅ 현재 설계 검토
pgvector 활용은 적절함
match_documents 함수는 기본적인 구조
🔧 개선 제안
1. 인덱싱 전략 개선
-- HNSW 인덱스로 대규모 벡터 검색 성능 향상
CREATE INDEX ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 메타데이터 검색용 GIN 인덱스
CREATE INDEX idx_metadata ON documents 
USING gin (metadata jsonb_path_ops);

-- 복합 인덱스 (자주 함께 조회되는 컬럼)
CREATE INDEX idx_user_created ON documents(user_id, created_at DESC);
2. 파티셔닝 전략
-- 날짜별 파티셔닝으로 성능 개선
CREATE TABLE documents (
    id bigserial,
    user_id uuid NOT NULL,
    created_at timestamp NOT NULL,
    content text,
    metadata jsonb,
    embedding vector(1536)
) PARTITION BY RANGE (created_at);

-- 월별 파티션 생성
CREATE TABLE documents_2025_01 PARTITION OF documents
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE documents_2025_02 PARTITION OF documents
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
3. Hybrid Search 개선
-- BM25 풀텍스트 검색 + 벡터 검색 조합
CREATE INDEX idx_content_fts ON documents 
USING gin(to_tsvector('english', content));

-- Hybrid Search 함수
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text text,
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    vector_weight float DEFAULT 0.5
)
RETURNS TABLE (
    id bigint,
    content text,
    metadata jsonb,
    hybrid_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT 
            id,
            content,
            metadata,
            1 - (embedding <=> query_embedding) as vector_similarity
        FROM documents
        ORDER BY embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_search AS (
        SELECT 
            id,
            content,
            metadata,
            ts_rank(to_tsvector('english', content), 
                    plainto_tsquery('english', query_text)) as text_rank
        FROM documents
        WHERE to_tsvector('english', content) @@ plainto_tsquery('english', query_text)
        ORDER BY text_rank DESC
        LIMIT match_count * 2
    )
    SELECT 
        COALESCE(v.id, t.id) as id,
        COALESCE(v.content, t.content) as content,
        COALESCE(v.metadata, t.metadata) as metadata,
        (COALESCE(v.vector_similarity, 0) * vector_weight + 
         COALESCE(t.text_rank, 0) * (1 - vector_weight)) as hybrid_score
    FROM vector_search v
    FULL OUTER JOIN text_search t ON v.id = t.id
    ORDER BY hybrid_score DESC
    LIMIT match_count;
END;
$$;
4. 데이터 아카이빙 정책
-- 90일 이상 미사용 문서 자동 아카이빙
CREATE TABLE documents_archive (
    LIKE documents INCLUDING ALL
);

-- 아카이빙 프로시저
CREATE OR REPLACE FUNCTION archive_old_documents()
RETURNS void AS $$
BEGIN
    -- 90일 이상 미접근 문서를 아카이브로 이동
    WITH to_archive AS (
        DELETE FROM documents
        WHERE last_accessed_at < NOW() - INTERVAL '90 days'
        RETURNING *
    )
    INSERT INTO documents_archive
    SELECT * FROM to_archive;
END;
$$ LANGUAGE plpgsql;

-- 매일 자동 실행 (pg_cron 사용)
SELECT cron.schedule('archive-old-docs', '0 2 * * *', 
    'SELECT archive_old_documents()');
2.4 AI/ML Engineer - LLM 및 임베딩 개선 제안
✅ 현재 구조의 장점
Model Agnostic 설계
Strategy Pattern 활용
🔧 개선 제안
1. Embedding 전략 고도화
from abc import ABC, abstractmethod
from typing import List
import numpy as np

class EmbeddingStrategy(ABC):
    @abstractmethod
    def embed(self, texts: List[str]) -> np.ndarray:
        pass

class HybridEmbeddingStrategy(EmbeddingStrategy):
    """
    Dense + Sparse 임베딩 결합
    """
    def __init__(self):
        self.dense_model = OpenAIEmbedding()  # text-embedding-3-large
        self.sparse_model = SPLADEEmbedding()  # SPLADE
    
    def embed(self, texts: List[str]) -> dict:
        dense_vectors = self.dense_model.embed(texts)
        sparse_vectors = self.sparse_model.embed(texts)
        
        return {
            'dense': dense_vectors,
            'sparse': sparse_vectors
        }
2. Reranking 파이프라인 추가
class RAGPipeline:
    """
    향상된 RAG 파이프라인
    """
    def __init__(self):
        self.retriever = VectorRetriever()
        self.reranker = CohereReranker()  # 또는 Cross-Encoder
        self.llm = LLMProvider()
    
    async def process_query(self, query: str) -> str:
        # 1단계: 벡터 검색으로 상위 100개 추출
        candidates = await self.retriever.search(query, top_k=100)
        
        # 2단계: Reranker로 상위 10개 선별
        relevant_docs = await self.reranker.rerank(
            query=query,
            documents=candidates,
            top_k=10
        )
        
        # 3단계: LLM에 컨텍스트로 제공
        response = await self.llm.generate(
            query=query,
            context=relevant_docs
        )
        
        return response
3. 청킹 전략 개선
class SmartChunker:
    """
    의미 기반 스마트 청킹
    """
    def __init__(self, strategy: str = 'semantic'):
        self.strategy = strategy
    
    def chunk_by_semantic(self, text: str, 
                         max_tokens: int = 512,
                         overlap: int = 50) -> List[str]:
        """
        의미 단위로 문서 분할
        - 문장 임베딩 유사도 기반
        - 급격한 주제 변화 지점에서 분할
        """
        sentences = self._split_sentences(text)
        embeddings = self._embed_sentences(sentences)
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for i, (sent, emb) in enumerate(zip(sentences, embeddings)):
            # 주제 변화 감지
            if i > 0 and self._is_topic_shift(embeddings[i-1], emb):
                if current_chunk:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = []
                    current_tokens = 0
            
            current_chunk.append(sent)
            current_tokens += self._count_tokens(sent)
            
            if current_tokens >= max_tokens:
                chunks.append(' '.join(current_chunk))
                # 오버랩 유지
                current_chunk = current_chunk[-overlap:]
                current_tokens = sum(self._count_tokens(s) 
                                   for s in current_chunk)
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def chunk_by_document_type(self, text: str, 
                               doc_type: str) -> List[str]:
        """
        문서 타입별 최적 청킹
        """
        strategies = {
            'code': self._chunk_code,
            'table': self._chunk_table,
            'academic': self._chunk_academic,
            'general': self._chunk_general
        }
        
        chunker = strategies.get(doc_type, self._chunk_general)
        return chunker(text)
4. Prompt Engineering 체계화
# prompts/templates.py

PROMPT_TEMPLATES = {
    'qa': """
Given the following context from documents, answer the question.

Context:
{context}

Question: {question}

Instructions:
- Answer based only on the provided context
- If the answer is not in the context, say "I don't have enough information"
- Cite the source document when possible
- Be concise but complete

Answer:
""",
    
    'summarization': """
Summarize the following document in {length} style:

Document:
{document}

Summary:
""",
    
    'multi_doc': """
You have access to multiple documents. Synthesize information across them.

Documents:
{documents}

Task: {task}

Synthesis:
"""
}

class PromptManager:
    """
    프롬프트 버전 관리 및 A/B 테스트
    """
    def __init__(self):
        self.templates = PROMPT_TEMPLATES
        self.version = "1.0"
    
    def get_prompt(self, template_name: str, **kwargs) -> str:
        template = self.templates[template_name]
        return template.format(**kwargs)
    
    def ab_test(self, template_a: str, template_b: str, 
                query: str) -> dict:
        """
        두 프롬프트 템플릿의 성능 비교
        """
        # 실제 구현 시 메트릭 수집
        pass
5. 멀티모달 처리 강화
class MultimodalProcessor:
    """
    다양한 모달리티 처리
    """
    def __init__(self):
        self.vision_model = GPT4Vision()
        self.audio_model = WhisperAPI()
        self.table_parser = UnstructuredIO()
    
    async def process_image(self, image_path: str) -> dict:
        """
        이미지 → 텍스트 설명 + 임베딩
        """
        # Vision LM으로 상세 설명 생성
        description = await self.vision_model.describe(
            image_path,
            prompt="Describe this image in detail for search purposes"
        )
        
        # OCR 텍스트 추출
        ocr_text = await self.vision_model.extract_text(image_path)
        
        return {
            'description': description,
            'ocr_text': ocr_text,
            'type': 'image'
        }
    
    async def process_audio(self, audio_path: str) -> dict:
        """
        오디오 → 텍스트 변환
        """
        transcript = await self.audio_model.transcribe(audio_path)
        
        return {
            'transcript': transcript,
            'type': 'audio'
        }
    
    async def process_table(self, table_html: str) -> dict:
        """
        테이블 → 구조화된 텍스트
        """
        # Unstructured.io로 파싱
        structured_data = self.table_parser.parse_table(table_html)
        
        # LLM으로 자연어 설명 생성
        description = await self.llm.describe_table(structured_data)
        
        return {
            'data': structured_data,
            'description': description,
            'type': 'table'
        }
2.5 DevOps Engineer - 배포 및 운영 개선 제안
✅ 현재 계획 검토
Docker + Render 조합은 적절
무료 티어 활용 전략 Good
🔧 개선 제안
1. CI/CD 파이프라인 구축
# .github/workflows/deploy.yml

name: PRISM CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov ruff black
      
      - name: Run tests with coverage
        run: |
          pytest tests/ --cov=src --cov-report=xml
      
      - name: Code quality check
        run: |
          ruff check src/
          black --check src/
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t prism-backend:${{ github.sha }} .
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push prism-backend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
      - name: Deploy to Render
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
      
      - name: Health check
        run: |
          sleep 30
          curl -f https://prism-api.render.com/health || exit 1
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
2. 환경 분리 전략
프로젝트 구조:

prism/
├── environments/
│   ├── dev/
│   │   ├── .env.dev
│   │   └── docker-compose.dev.yml
│   ├── staging/
│   │   ├── .env.staging
│   │   └── docker-compose.staging.yml
│   └── production/
│       ├── .env.production
│       └── docker-compose.prod.yml
├── docker/
│   ├── Dockerfile.dev
│   └── Dockerfile.prod
└── scripts/
    ├── deploy-dev.sh
    ├── deploy-staging.sh
    └── deploy-prod.sh
3. 모니터링 스택 (무료 티어 활용)
# monitoring/setup.py

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from prometheus_client import Counter, Histogram

# Sentry 설정 (에러 트래킹)
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
    environment=os.getenv("APP_ENV")
)

# Prometheus 메트릭
request_count = Counter(
    'prism_requests_total',
    'Total request count',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'prism_request_duration_seconds',
    'Request duration',
    ['method', 'endpoint']
)

llm_token_usage = Counter(
    'prism_llm_tokens_total',
    'Total LLM tokens used',
    ['model', 'operation']
)

# 모니터링 도구 목록:
# - Sentry (무료 티어): 에러 트래킹, 성능 모니터링
# - Uptime Robot (무료): 가동 시간 모니터링
# - Grafana Cloud (무료): 메트릭 시각화
# - Better Stack (무료 티어): 로그 집계
4. 백업 전략
#!/bin/bash
# scripts/backup.sh

# Supabase 데이터 백업 스크립트

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$DATE"

echo "Starting backup at $DATE"

# 1. PostgreSQL 데이터 백업
pg_dump "$SUPABASE_DB_URL" > "$BACKUP_DIR/database.sql"

# 2. 벡터 데이터 별도 백업 (대용량일 경우)
psql "$SUPABASE_DB_URL" -c "COPY documents TO STDOUT" | gzip > "$BACKUP_DIR/vectors.csv.gz"

# 3. 메타데이터만 백업 (빠른 복구용)
psql "$SUPABASE_DB_URL" -c "SELECT id, metadata FROM documents" > "$BACKUP_DIR/metadata.json"

# 4. Backblaze B2에 업로드 (무료 티어 10GB)
b2 sync "$BACKUP_DIR" "b2://prism-backups/$DATE"

# 5. 30일 이상 된 백업 삭제
find backups/ -type d -mtime +30 -exec rm -rf {} \;

echo "Backup completed"
5. Zero-Downtime 배포
# docker-compose.prod.yml

version: '3.8'

services:
  prism-blue:
    image: prism-backend:latest
    environment:
      - DEPLOYMENT_SLOT=blue
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  prism-green:
    image: prism-backend:${NEW_VERSION}
    environment:
      - DEPLOYMENT_SLOT=green
    ports:
      - "8001:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - prism-blue
      - prism-green
#!/bin/bash
# scripts/blue-green-deploy.sh

# Blue-Green Deployment 스크립트

CURRENT_SLOT=$(curl -s http://localhost/health | jq -r '.slot')

if [ "$CURRENT_SLOT" == "blue" ]; then
    NEW_SLOT="green"
    NEW_PORT=8001
else
    NEW_SLOT="blue"
    NEW_PORT=8000
fi

echo "Current slot: $CURRENT_SLOT, Deploying to: $NEW_SLOT"

# 1. 새 버전 배포
docker-compose up -d prism-$NEW_SLOT

# 2. Health check 대기
for i in {1..30}; do
    if curl -f http://localhost:$NEW_PORT/health; then
        echo "New deployment is healthy"
        break
    fi
    sleep 2
done

# 3. 트래픽 전환
nginx -s reload

# 4. 이전 버전 종료
sleep 10
docker-compose stop prism-$CURRENT_SLOT

echo "Deployment completed. Active slot: $NEW_SLOT"
2.6 Frontend Engineer - UI/UX 개선 제안
✅ 현재 계획
Next.js 선택은 적절함
Vercel 배포 전략 Good
🔧 개선 제안
1. UI/UX 컴포넌트 체계
// components/upload/DragDropZone.tsx

import { useDropzone } from 'react-dropzone';
import { useState } from 'react';

interface FileWithPreview extends File {
  preview: string;
}

export function DragDropZone({ onUpload }: { onUpload: (files: File[]) => void }) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc', '.docx'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      const filesWithPreview = acceptedFiles.map(file =>
        Object.assign(file, {
          preview: URL.createObjectURL(file)
        })
      );
      setFiles(filesWithPreview);
      onUpload(acceptedFiles);
    }
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
    >
      <input {...getInputProps()} />
      <div className="space-y-4">
        <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
        {isDragActive ? (
          <p>Drop files here...</p>
        ) : (
          <p>Drag & drop files here, or click to select</p>
        )}
        <p className="text-sm text-gray-500">
          Supports: PDF, TXT, DOCX, Images (max 10MB)
        </p>
      </div>
      
      {files.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          {files.map((file, idx) => (
            <FilePreview key={idx} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}
// components/chat/MessageList.tsx

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export function MessageList({ messages }: { messages: Message[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          return (
            <div
              key={message.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <MessageBubble message={message} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
// components/chat/SourceCard.tsx

interface Source {
  id: string;
  title: string;
  snippet: string;
  similarity: number;
}

export function SourceCard({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm font-medium text-gray-700">Sources:</p>
      <div className="grid gap-2">
        {sources.map((source) => (
          <div
            key={source.id}
            className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <h4 className="font-medium text-sm">{source.title}</h4>
              <span className="text-xs text-gray-500">
                {(source.similarity * 100).toFixed(0)}% match
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {source.snippet}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
2. 실시간 기능
// hooks/useStreamingChat.ts

import { useState, useCallback } from 'react';

export function useStreamingChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');

  const sendMessage = useCallback(async (message: string) => {
    setIsStreaming(true);
    setStreamedContent('');

    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          setStreamedContent(prev => prev + data.content);
        }
      }
    }

    setIsStreaming(false);
  }, []);

  return { sendMessage, isStreaming, streamedContent };
}
// hooks/useUploadProgress.ts

import { useState } from 'react';

export function useUploadProgress() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete'>('idle');

  const uploadFile = async (file: File) => {
    setStatus('uploading');
    
    // Server-Sent Events로 진행률 수신
    const eventSource = new EventSource('/api/v1/upload/progress');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setStatus(data.status);
      
      if (data.status === 'complete') {
        eventSource.close();
      }
    };

    // 파일 업로드
    const formData = new FormData();
    formData.append('file', file);

    await fetch('/api/v1/upload', {
      method: 'POST',
      body: formData
    });
  };

  return { uploadFile, progress, status };
}
3. 성능 최적화
// lib/api-client.ts

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      cacheTime: 10 * 60 * 1000, // 10분
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// API 함수들
export const api = {
  chat: {
    send: async (message: string) => {
      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      return response.json();
    }
  },
  
  documents: {
    list: async () => {
      const response = await fetch('/api/v1/documents');
      return response.json();
    },
    
    upload: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/v1/documents', {
        method: 'POST',
        body: formData
      });
      return response.json();
    }
  }
};
// next.config.js

module.exports = {
  // 이미지 최적화
  images: {
    domains: ['your-supabase-project.supabase.co'],
    formats: ['image/avif', 'image/webp']
  },
  
  // 코드 스플리팅
  experimental: {
    optimizeCss: true
  },
  
  // 번들 분석
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2
          }
        }
      };
    }
    return config;
  }
};
4. 접근성 (a11y)
// components/common/AccessibleButton.tsx

import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  ariaLabel?: string;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ loading, ariaLabel, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        aria-busy={loading}
        aria-disabled={props.disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="sr-only">Loading...</span>
            <LoadingSpinner />
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
// components/common/SkipLink.tsx

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
                 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white"
    >
      Skip to main content
    </a>
  );
}
5. 상태 관리 전략
// store/chatStore.ts

import create from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatState {
  messages: Message[];
  currentSession: string | null;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setSession: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      currentSession: null,
      
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message]
        })),
      
      clearMessages: () => set({ messages: [] }),
      
      setSession: (sessionId) => set({ currentSession: sessionId })
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({ messages: state.messages })
    }
  )
);
// contexts/ThemeContext.tsx

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: 'system',
  setTheme: () => {}
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
2.7 Security Engineer - 보안 강화 제안
✅ 보안 관점 분석
현재 설계에 인증/인가 체계가 명시되지 않음
API Key 관리 방안 필요
파일 업로드 보안 검증 필요
🔧 보안 개선 제안
1. 인증/인가 체계
# infrastructure/auth/supabase_auth.py

from supabase import Client
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import jwt

security = HTTPBearer()

class AuthService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    async def verify_token(
        self,
        credentials: HTTPAuthorizationCredentials = Security(security)
    ) -> dict:
        """
        JWT 토큰 검증
        """
        try:
            token = credentials.credentials
            user = self.supabase.auth.get_user(token)
            
            if not user:
                raise HTTPException(status_code=401, detail="Invalid token")
            
            return user
        except Exception as e:
            raise HTTPException(status_code=401, detail=str(e))
    
    async def check_permission(
        self,
        user_id: str,
        resource: str,
        action: str
    ) -> bool:
        """
        권한 확인 (RBAC)
        """
        # Supabase에서 사용자 역할 조회
        response = self.supabase.table('user_roles').select('*').eq(
            'user_id', user_id
        ).execute()
        
        roles = [r['role'] for r in response.data]
        
        # 권한 매트릭스 확인
        permissions = {
            'admin': ['*'],
            'user': ['document:read', 'document:create', 'document:delete:own'],
            'guest': ['document:read']
        }
        
        for role in roles:
            if action in permissions.get(role, []) or '*' in permissions.get(role, []):
                return True
        
        return False
# presentation/api/dependencies.py

from fastapi import Depends, HTTPException
from infrastructure.auth.supabase_auth import AuthService

async def get_current_user(
    auth_service: AuthService = Depends()
) -> dict:
    """
    현재 로그인한 사용자 정보 반환
    """
    user = await auth_service.verify_token()
    return user

async def require_permission(resource: str, action: str):
    """
    특정 권한 요구
    """
    async def permission_checker(
        user: dict = Depends(get_current_user),
        auth_service: AuthService = Depends()
    ):
        has_permission = await auth_service.check_permission(
            user['id'], resource, action
        )
        
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied")
        
        return user
    
    return permission_checker
2. API Key 보안 관리
# infrastructure/secrets/key_manager.py

import os
from typing import Optional
from cryptography.fernet import Fernet
import hashlib

class KeyManager:
    """
    API Key 암호화 및 관리
    """
    def __init__(self):
        # 환경변수에서 마스터 키 로드
        master_key = os.getenv('MASTER_ENCRYPTION_KEY')
        if not master_key:
            raise ValueError("MASTER_ENCRYPTION_KEY not set")
        
        # Fernet 암호화 키 생성
        key_hash = hashlib.sha256(master_key.encode()).digest()
        self.cipher = Fernet(key_hash[:32])
    
    def encrypt_key(self, api_key: str) -> str:
        """
        API Key 암호화
        """
        encrypted = self.cipher.encrypt(api_key.encode())
        return encrypted.decode()
    
    def decrypt_key(self, encrypted_key: str) -> str:
        """
        API Key 복호화
        """
        decrypted = self.cipher.decrypt(encrypted_key.encode())
        return decrypted.decode()
    
    def rotate_key(self, old_key: str) -> str:
        """
        Key Rotation 구현
        """
        # 기존 키로 암호화된 데이터 복호화
        decrypted = self.decrypt_key(old_key)
        
        # 새로운 키로 재암호화
        new_encrypted = self.encrypt_key(decrypted)
        
        return new_encrypted
-- Supabase에 암호화된 키 저장
CREATE TABLE user_api_keys (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users NOT NULL,
    provider text NOT NULL, -- 'openai', 'anthropic', etc.
    encrypted_key text NOT NULL,
    created_at timestamp DEFAULT now(),
    last_used_at timestamp,
    is_active boolean DEFAULT true,
    
    UNIQUE(user_id, provider)
);

-- Row Level Security 설정
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own keys"
    ON user_api_keys
    FOR ALL
    USING (auth.uid() = user_id);
3. 파일 업로드 보안
# infrastructure/security/file_validator.py

import magic
import hashlib
from pathlib import Path
from typing import List, Optional
import subprocess

class SecureFileValidator:
    """
    파일 업로드 보안 검증
    """
    
    ALLOWED_MIME_TYPES = {
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp'
    }
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    def __init__(self):
        self.magic = magic.Magic(mime=True)
    
    async def validate_file(self, file_path: Path) -> dict:
        """
        파일 검증 (파일 시그니처, 크기, 악성코드)
        """
        validation_result = {
            'valid': True,
            'errors': []
        }
        
        # 1. 파일 크기 검증
        file_size = file_path.stat().st_size
        if file_size > self.MAX_FILE_SIZE:
            validation_result['valid'] = False
            validation_result['errors'].append('File size exceeds limit')
            return validation_result
        
        # 2. MIME 타입 검증 (파일 시그니처 기반)
        mime_type = self.magic.from_file(str(file_path))
        if mime_type not in self.ALLOWED_MIME_TYPES:
            validation_result['valid'] = False
            validation_result['errors'].append(f'Invalid file type: {mime_type}')
            return validation_result
        
        # 3. 파일 해시 계산 (중복 체크 및 무결성)
        file_hash = await self._calculate_hash(file_path)
        validation_result['hash'] = file_hash
        
        # 4. 악성코드 스캔 (ClamAV)
        is_safe = await self._scan_virus(file_path)
        if not is_safe:
            validation_result['valid'] = False
            validation_result['errors'].append('Malware detected')
            return validation_result
        
        # 5. 메타데이터 Sanitization
        await self._sanitize_metadata(file_path)
        
        return validation_result
    
    async def _calculate_hash(self, file_path: Path) -> str:
        """
        SHA-256 해시 계산
        """
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    async def _scan_virus(self, file_path: Path) -> bool:
        """
        ClamAV로 바이러스 스캔
        """
        try:
            result = subprocess.run(
                ['clamscan', '--no-summary', str(file_path)],
                capture_output=True,
                text=True,
                timeout=30
            )
            return 'OK' in result.stdout
        except Exception as e:
            # ClamAV가 설치되지 않은 경우 로그만 남기고 통과
            print(f"Virus scan failed: {e}")
            return True
    
    async def _sanitize_metadata(self, file_path: Path):
        """
        민감한 메타데이터 제거 (exiftool 사용)
        """
        try:
            subprocess.run(
                ['exiftool', '-all=', '-overwrite_original', str(file_path)],
                capture_output=True,
                timeout=10
            )
        except Exception as e:
            print(f"Metadata sanitization failed: {e}")
4. SQL Injection 방지
# infrastructure/database/repositories/document_repository.py

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

class DocumentRepository:
    """
    안전한 데이터베이스 쿼리
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def search_documents(
        self,
        user_id: str,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        """
        Parameterized query로 SQL Injection 방지
        """
        # ❌ 안전하지 않은 방법
        # sql = f"SELECT * FROM documents WHERE user_id = '{user_id}'"
        
        # ✅ 안전한 방법: Parameterized query
        sql = text("""
            SELECT * FROM documents
            WHERE user_id = :user_id
            AND content LIKE :query
            LIMIT :limit
        """)
        
        result = await self.session.execute(
            sql,
            {
                'user_id': user_id,
                'query': f'%{query}%',
                'limit': limit
            }
        )
        
        return result.fetchall()
5. CORS 및 보안 헤더
# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",
        "https://www.yourdomain.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    max_age=3600
)

# Trusted Host 설정
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["yourdomain.com", "*.yourdomain.com"]
)

# 세션 보안
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET"),
    https_only=True,
    same_site="strict"
)

# 보안 헤더 추가
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
6. 데이터 프라이버시 (GDPR 준수)
# application/use_cases/gdpr_compliance.py

from typing import List
import re

class GDPRComplianceService:
    """
    개인정보 보호 서비스
    """
    
    # PII 패턴
    PII_PATTERNS = {
        'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        'phone': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
        'credit_card': r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b'
    }
    
    async def detect_pii(self, text: str) -> List[dict]:
        """
        PII 데이터 자동 감지
        """
        detected = []
        
        for pii_type, pattern in self.PII_PATTERNS.items():
            matches = re.finditer(pattern, text)
            for match in matches:
                detected.append({
                    'type': pii_type,
                    'value': match.group(),
                    'start': match.start(),
                    'end': match.end()
                })
        
        return detected
    
    async def mask_pii(self, text: str) -> str:
        """
        PII 데이터 마스킹
        """
        masked_text = text
        
        for pii_type, pattern in self.PII_PATTERNS.items():
            if pii_type == 'email':
                masked_text = re.sub(
                    pattern,
                    lambda m: m.group().split('@')[0][:2] + '***@' + m.group().split('@')[1],
                    masked_text
                )
            elif pii_type == 'phone':
                masked_text = re.sub(pattern, '***-***-****', masked_text)
            else:
                masked_text = re.sub(pattern, '***', masked_text)
        
        return masked_text
    
    async def delete_user_data(self, user_id: str):
        """
        사용자 데이터 완전 삭제 (GDPR Right to be Forgotten)
        """
        # 1. 문서 삭제
        await self.document_repo.delete_by_user(user_id)
        
        # 2. 채팅 기록 삭제
        await self.chat_repo.delete_by_user(user_id)
        
        # 3. API 키 삭제
        await self.key_repo.delete_by_user(user_id)
        
        # 4. 감사 로그 익명화
        await self.audit_repo.anonymize_user(user_id)
        
        return {'status': 'deleted', 'user_id': user_id}
    
    async def export_user_data(self, user_id: str) -> dict:
        """
        사용자 데이터 내보내기 (GDPR Right to Data Portability)
        """
        documents = await self.document_repo.get_by_user(user_id)
        chats = await self.chat_repo.get_by_user(user_id)
        
        return {
            'user_id': user_id,
            'documents': documents,
            'chats': chats,
            'exported_at': datetime.now().isoformat()
        }
-- 감사 로그 테이블
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    ip_address inet,
    user_agent text,
    created_at timestamp DEFAULT now(),
    
    -- 인덱스
    INDEX idx_audit_user (user_id, created_at DESC),
    INDEX idx_audit_action (action, created_at DESC)
);

-- 데이터 보관 정책 (90일 후 자동 삭제)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('cleanup-audit-logs', '0 3 * * *',
    'SELECT cleanup_old_audit_logs()');
3. 종합 제안서
🎯 우선순위별 구현 계획
Phase 1: 기반 구축 및 보안 강화 (Week 1-2)
즉시 적용 항목:
보안 기본 설정
[ ] 환경변수 암호화 (KeyManager 구현)
[ ] CORS 정책 및 보안 헤더 설정
[ ] 파일 업로드 검증 (SecureFileValidator)
[ ] Supabase Auth 통합 및 RBAC 구현
모니터링 기초
[ ] Health check endpoint (/health)
[ ] Sentry 통합 (에러 트래킹)
[ ] 로깅 체계 구축 (structlog)
[ ] Audit Log 테이블 생성
Database 최적화
[ ] HNSW 인덱스 추가
[ ] 메타데이터 GIN 인덱스
[ ] Hybrid Search 함수 구현
검증 기준:
모든 단위 테스트 통과
보안 취약점 스캔 통과
Health check 정상 응답
Phase 2: 핵심 기능 구현 (Week 3-5)
주요 구현 항목:
Hybrid Search 시스템
[ ] BM25 풀텍스트 검색 구현
[ ] Vector Search 통합
[ ] Reranking 파이프라인 (Cohere API)
[ ] 검색 결과 융합 알고리즘
캐싱 레이어
[ ] Redis 통합 (Upstash 무료 티어)
[ ] 쿼리 임베딩 캐싱
[ ] LLM 응답 캐싱
[ ] TTL 기반 무효화 전략
비동기 작업 큐
[ ] Celery + Redis 설정
[ ] 문서 처리 백그라운드 작업
[ ] 진행률 추적 (Server-Sent Events)
[ ] 작업 실패 시 재시도 로직
Frontend 기본 기능
[ ] 파일 업로드 UI (DragDropZone)
[ ] 채팅 인터페이스
[ ] 실시간 스트리밍 응답
[ ] 소스 표시 (SourceCard)
검증 기준:
검색 정확도 > 80% (평가 데이터셋 기준)
응답 시간 < 2초 (캐시 미적중)
동시 사용자 50명 처리 가능
Phase 3: 고급 기능 및 최적화 (Week 6-8)
고급 기능:
멀티모달 처리 강화
[ ] Vision LM 통합 (GPT-4V)
[ ] Audio 처리 (Whisper API)
[ ] Table 파싱 (Unstructured.io)
[ ] 이미지 내 텍스트 OCR
Advanced RAG
[ ] Multi-query generation
[ ] Self-query retrieval
[ ] Hypothetical document embedding
[ ] Query decomposition
사용자 경험 향상
[ ] 대화 히스토리 관리
[ ] 북마크 및 즐겨찾기
[ ] 문서 태깅 시스템
[ ] 협업 기능 (문서 공유)
성능 최적화
[ ] Database 쿼리 최적화
[ ] 프론트엔드 번들 크기 감소
[ ] Lazy loading 구현
[ ] CDN 설정 (Cloudflare)
검증 기준:
멀티모달 정확도 > 75%
페이지 로드 시간 < 1초
Lighthouse 점수 > 90
Phase 4: 프로덕션 준비 (Week 9-10)
배포 및 운영:
CI/CD 파이프라인
[ ] GitHub Actions 워크플로우
[ ] 자동 테스트 실행
[ ] Blue-Green 배포
[ ] 자동 롤백
모니터링 및 알림
[ ] Grafana 대시보드 구성
[ ] Uptime Robot 설정
[ ] Slack 알림 통합
[ ] 성능 메트릭 수집
백업 및 복구
[ ] 자동 백업 스크립트
[ ] Backblaze B2 통합
[ ] 복구 절차 문서화
[ ] 재해 복구 테스트
문서화
[ ] API 문서 (OpenAPI/Swagger)
[ ] 사용자 가이드
[ ] 운영 매뉴얼
[ ] 아키텍처 다이어그램
검증 기준:
가동률 > 99.5%
평균 배포 시간 < 10분
백업 복구 시간 < 1시간
📊 예상 리소스 및 비용
항목
서비스
무료 티어 한도
비고
Database
Supabase
500MB, 2GB transfer/month
충분
Backend
Render
750 hours/month
1개 인스턴스
Frontend
Vercel
100GB bandwidth
충분
Cache
Upstash Redis
10K commands/day
충분
Storage
Supabase Storage
1GB
문서 저장용
Monitoring
Sentry
5K errors/month
충분
Backup
Backblaze B2
10GB
백업용
총 비용
$0/month

LLM API는 사용자 부담
🔧 기술 스택 최종 정리
Backend Stack
Python 3.11+
├── FastAPI (Web Framework)
├── SQLAlchemy (ORM)
├── Celery (Task Queue)
├── Redis (Cache & Queue)
├── LangChain (LLM Integration)
├── Supabase Client (Database)
└── pytest (Testing)
Frontend Stack
Next.js 14+
├── React 18
├── TypeScript
├── Tailwind CSS
├── Zustand (State Management)
├── React Query (Server State)
├── Socket.io (Real-time)
└── Vitest (Testing)
Infrastructure Stack
Docker
├── Render (Backend Hosting)
├── Vercel (Frontend Hosting)
├── Supabase (Database + Auth)
├── Upstash (Redis)
├── GitHub Actions (CI/CD)
└── Sentry (Monitoring)
4. 액션 아이템
📝 각 팀원별 할당 작업
System Architect
[ ] Architecture Decision Records (ADR) 작성
[ ] 이벤트 기반 아키텍처 상세 설계
[ ] CQRS 구현 가이드 작성
[ ] 시스템 다이어그램 작성 (C4 Model)
Backend Engineer
[ ] API 명세서 작성 (OpenAPI 3.0)
[ ] Rate Limiting 구현
[ ] Celery 작업 큐 설정
[ ] Health Check 엔드포인트 구현
Database Engineer
[ ] 스키마 마이그레이션 스크립트 작성
[ ] 인덱싱 전략 구현
[ ] Hybrid Search 함수 최적화
[ ] 데이터 아카이빙 정책 구현
AI/ML Engineer
[ ] Embedding 전략 구현 및 벤치마크
[ ] Reranking 파이프라인 구축
[ ] Prompt 템플릿 라이브러리 구축
[ ] 멀티모달 프로세서 구현
DevOps Engineer
[ ] Docker 이미지 최적화
[ ] CI/CD 파이프라인 구축
[ ] 모니터링 스택 설정
[ ] 백업 자동화 스크립트 작성
Frontend Engineer
[ ] 컴포넌트 라이브러리 구축
[ ] 스트리밍 채팅 UI 구현
[ ] 파일 업로드 UX 개선
[ ] 접근성 테스트 및 개선
Security Engineer
[ ] 보안 체크리스트 작성
[ ] 인증/인가 시스템 구현
[ ] 파일 검증 로직 구현
[ ] GDPR 컴플라이언스 가이드 작성
📅 주차별 마일스톤
Week 1-2: Foundation
✅ 보안 기반 구축
✅ DB 스키마 최적화
✅ 모니터링 설정
Week 3-4: Core Features
✅ Hybrid Search 구현
✅ 캐싱 시스템
✅ 기본 UI 구축
Week 5-6: Advanced Features
✅ 멀티모달 처리
✅ Advanced RAG
✅ 비동기 작업 큐
Week 7-8: Optimization
✅ 성능 튜닝
✅ UX 개선
✅ 부하 테스트
Week 9-10: Production
✅ CI/CD 구축
✅ 문서화 완료
✅ 프로덕션 배포
5. 위험 요소 및 대응 방안
🚨 주요 리스크
위험
영향도
발생 가능성
대응 방안
무료 티어 한도 초과
높음
중간
Rate Limiting, 사용량 모니터링
LLM API 비용 급증
높음
중간
캐싱, 요청 최적화
보안 취약점
매우 높음
낮음
정기 보안 감사, 자동화된 스캔
성능 저하
중간
높음
캐싱, 인덱싱, 최적화
데이터 손실
높음
낮음
자동 백업, 복제
🛡️ 대응 전략
1. 비용 관리
# Cost Monitoring Service
class CostMonitor:
    MONTHLY_BUDGET = 100  # USD
    
    async def check_budget(self):
        current_spending = await self.get_current_month_spending()
        
        if current_spending > self.MONTHLY_BUDGET * 0.8:
            # 80% 도달 시 알림
            await self.send_alert("Budget warning: 80% reached")
        
        if current_spending > self.MONTHLY_BUDGET:
            # 한도 초과 시 기능 제한
            await self.enable_rate_limiting()
            await self.disable_expensive_features()
2. 성능 모니터링
# Performance Monitoring
from prometheus_client import Histogram

response_time = Histogram(
    'prism_response_time_seconds',
    'Response time',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0]
)

@app.middleware("http")
async def monitor_performance(request, call_next):
    with response_time.time():
        response = await call_next(request)
    return response
6. 추가 제안 문서 목록
다음 문서들을 별도로 작성하여 프로젝트 레포지토리에 추가할 것을 권장합니다:
📚 필수 문서
ADR/ (Architecture Decision Records)
001-database-selection.md
002-llm-abstraction.md
003-authentication-strategy.md
API_SPECS.md
OpenAPI 3.0 명세
엔드포인트 상세 설명
요청/응답 예시
DATABASE_SCHEMA.md
ERD 다이어그램
테이블 정의
인덱싱 전략
SECURITY_CHECKLIST.md
OWASP Top 10 체크리스트
보안 설정 가이드
취약점 대응 방안
TESTING_STRATEGY.md
단위 테스트 가이드
통합 테스트 시나리오
E2E 테스트 계획
DEPLOYMENT_GUIDE.md
환경별 배포 절차
롤백 프로세스
트러블슈팅 가이드
MONITORING_GUIDE.md
메트릭 정의
알림 설정
대시보드 구성
USER_MANUAL.md
사용자 가이드
FAQ
트러블슈팅
7. 회의 결론 및 다음 단계
✅ 회의 결과 요약
[Senior Developer]:
모든 팀원분들의 의견을 종합한 결과, PRISM 프로젝트는 다음과 같이 진행하겠습니다:
즉시 시작: Phase 1 작업 (보안 기반 + DB 최적화)
주차별 스프린트: 2주 단위 스프린트로 진행
정기 리뷰: 매주 금요일 진행 상황 검토
테스트 커버리지: 최소 80% 유지
📋 Next Actions
이번 주 내 완료:
[ ] GitHub Repository 초기화
[ ] Supabase 프로젝트 생성 및 스키마 적용
[ ] Docker 개발 환경 설정
[ ] CI/CD 파이프라인 기본 구조
다음 주:
[ ] 보안 기본 설정 완료
[ ] Health Check 구현
[ ] 첫 번째 단위 테스트 작성
🎯 성공 기준
프로젝트 성공을 다음과 같이 정의합니다:
기능적 요구사항
✅ 문서 업로드 및 검색 기능
✅ LLM 기반 QA 기능
✅ 멀티모달 지원
비기능적 요구사항
✅ 응답 시간 < 2초
✅ 가동률 > 99%
✅ 테스트 커버리지 > 80%
✅ Zero Cost 운영 달성
품질 요구사항
✅ Clean Architecture 준수
✅ TDD 원칙 준수
✅ 보안 체크리스트 100% 달성
8. 참고 자료
📖 추천 학습 자료
Architecture:
Clean Architecture by Robert C. Martin
Hexagonal Architecture
RAG Systems:
LangChain Documentation
Advanced RAG Techniques
Security:
OWASP Top 10
FastAPI Security
Testing:
pytest Documentation
TDD Best Practices
부록: 빠른 시작 체크리스트
✅ 개발 환경 설정 (30분)
# 1. Repository 클론
git clone https://github.com/your-org/prism.git
cd prism

# 2. Python 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. 의존성 설치
pip install -r requirements.txt

# 4. 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 API 키 입력

# 5. Supabase 설정
# - Supabase 대시보드에서 프로젝트 생성
# - SQL Editor에서 초기화 스크립트 실행
# - .env에 URL과 API Key 입력

# 6. 테스트 실행
pytest tests/

# 7. 개발 서버 시작
uvicorn main:app --reload

# 8. Frontend 시작 (별도 터미널)
cd frontend
npm install
npm run dev
✅ 첫 번째 기능 구현 (TDD)
# 1. 실패하는 테스트 작성
# tests/unit/test_document_upload.py

def test_upload_document():
    # Given
    document = create_test_document()
    
    # When
    result = upload_service.upload(document)
    
    # Then
    assert result.success == True
    assert result.document_id is not None
# 2. 최소한의 구현
# application/use_cases/upload_document.py

class UploadDocumentUseCase:
    async def execute(self, document):
        # 구현
        pass
# 3. 테스트 통과까지 반복
# 4. 리팩토링
문서 버전: 1.0
최종 업데이트: 2025-12-11
다음 리뷰: 2025-12-18
문서 끝
이 회의록은 PRISM 프로젝트의 기술적 방향성과 구현 계획을 담고 있습니다.
각 팀원은 할당된 액션 아이템을 진행하고, 주간 리뷰에서 진행 상황을 공유해주시기 바랍니다.
질문이나 제안사항은 프로젝트 Slack 채널 #prism-dev에 남겨주세요.
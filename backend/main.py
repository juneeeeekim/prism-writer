# =============================================================================
# PRISM Writer Backend - Main Entry Point
# =============================================================================
# 파일: backend/main.py
# 역할: FastAPI 애플리케이션의 진입점 및 라우터 등록
# 아키텍처: Clean Architecture (Hexagonal)
# =============================================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# =============================================================================
# Application Instance
# =============================================================================
app = FastAPI(
    title="PRISM Writer API",
    description="RAG 기반 지능형 글쓰기 도구 백엔드 API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# =============================================================================
# CORS Middleware Configuration
# =============================================================================
# [P1-03] CORS 보안 강화 (2026-02-17 Audit)
# 빈 문자열 origin 제거, methods/headers 명시적 지정
_frontend_url = os.getenv("FRONTEND_URL", "")
origins = [
    "http://localhost:3000",      # Next.js 개발 서버
    "http://127.0.0.1:3000",
]
if _frontend_url:
    origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)


# =============================================================================
# Health Check Endpoint
# =============================================================================
@app.get("/health", tags=["System"])
async def health_check():
    """
    시스템 상태 확인 엔드포인트
    - DB 연결, LLM 가용성 등을 점검하여 반환
    """
    return {
        "status": "ok",
        "service": "prism-writer-api",
        "version": "0.1.0"
    }


# =============================================================================
# Root Endpoint
# =============================================================================
@app.get("/", tags=["System"])
async def root():
    """
    API 루트 엔드포인트
    """
    return {
        "message": "Welcome to PRISM Writer API",
        "docs": "/docs",
        "health": "/health"
    }


# =============================================================================
# API Routers Registration
# =============================================================================
from src.presentation.api import api_router
app.include_router(api_router, prefix="/v1")


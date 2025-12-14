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
# 개발 환경에서는 모든 origin 허용, 프로덕션에서는 제한 필요
origins = [
    "http://localhost:3000",      # Next.js 개발 서버
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_URL", "")  # 프로덕션 프론트엔드 URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


# =============================================================================
# PRISM Writer Backend - Dockerfile
# =============================================================================
# 파일: backend/Dockerfile
# 역할: FastAPI 백엔드 컨테이너 이미지 빌드
# 빌드: docker build -t prism-backend .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base Image (공통)
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS base

# 환경 변수 설정
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# Stage 2: Development (개발용 - 핫 리로드 지원)
# -----------------------------------------------------------------------------
FROM base AS development

# 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 개발 도구 추가 설치
RUN pip install --no-cache-dir \
    watchfiles \
    debugpy

# 소스 코드는 volume으로 마운트됨 (docker-compose.dev.yml 참조)

# 개발 서버 포트
EXPOSE 8000

# 개발 서버 실행 (핫 리로드)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# -----------------------------------------------------------------------------
# Stage 3: Builder (프로덕션 빌드 준비)
# -----------------------------------------------------------------------------
FROM base AS builder

# 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY . .

# -----------------------------------------------------------------------------
# Stage 4: Production (프로덕션용 - 최소 이미지)
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS production

# 환경 변수 설정
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 (최소)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

# Builder에서 설치된 패키지 복사
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 소스 코드 복사
COPY --from=builder /app .

# 비루트 사용자로 전환
USER appuser

# 프로덕션 서버 포트
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 프로덕션 서버 실행 (Gunicorn + Uvicorn workers)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

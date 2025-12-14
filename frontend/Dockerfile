# =============================================================================
# PRISM Writer Frontend - Dockerfile
# =============================================================================
# 파일: frontend/Dockerfile
# 역할: Next.js 프론트엔드 컨테이너 이미지 빌드
# 빌드: docker build -t prism-frontend .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base Image (공통)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# 환경 변수 설정
ENV NEXT_TELEMETRY_DISABLED=1

# 작업 디렉토리 설정
WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Development (개발용 - 핫 리로드 지원)
# -----------------------------------------------------------------------------
FROM base AS development

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치 (개발용 포함)
RUN npm ci

# 소스 코드는 volume으로 마운트됨 (docker-compose.dev.yml 참조)

# 개발 서버 포트
EXPOSE 3000

# 환경 변수 설정
ENV NODE_ENV=development

# 개발 서버 실행
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Stage 3: Dependencies (의존성 설치)
# -----------------------------------------------------------------------------
FROM base AS deps

# 패키지 파일 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production

# -----------------------------------------------------------------------------
# Stage 4: Builder (프로덕션 빌드)
# -----------------------------------------------------------------------------
FROM base AS builder

# 패키지 파일 복사
COPY package*.json ./

# 모든 의존성 설치 (빌드에 필요)
RUN npm ci

# 소스 코드 복사
COPY . .

# 환경 변수 (빌드 시 필요)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Next.js 빌드
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 5: Production (프로덕션용 - 최소 이미지)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# 환경 변수 설정
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# 작업 디렉토리 설정
WORKDIR /app

# 비루트 사용자 생성
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 프로덕션 의존성 복사
COPY --from=deps /app/node_modules ./node_modules

# 빌드 결과물 복사
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 비루트 사용자로 전환
USER nextjs

# 프로덕션 서버 포트
EXPOSE 3000

# 포트 환경 변수
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 프로덕션 서버 실행
CMD ["node", "server.js"]

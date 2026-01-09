# 📘 PRISM Writer Technical Manual v2.0

**문서 번호**: TEC-2026-0109-V2
**작성일**: 2026-01-09
**버전**: v2.0 (Deep Scholar, Shadow Writer 및 핵심 기능 통합)
**대상**: 개발팀, 운영팀, 유지보수 담당자

---

## 📋 목차

1. [시스템 개요](#1-시스템-개요)
2. [핵심 기능 상세](#2-핵심-기능-상세)
   - [2.1 Deep Scholar (심층 연구)](#21-deep-scholar-심층-연구)
   - [2.2 Shadow Writer (AI 섀도우 라이터)](#22-shadow-writer-ai-섀도우-라이터)
   - [2.3 Dynamic Outline Map (동적 구조 맵)](#23-dynamic-outline-map-동적-구조-맵)
   - [2.4 Adaptive Threshold (적응형 임계값)](#24-adaptive-threshold-적응형-임계값)
   - [2.5 Reference Engine & RAG (참고 자료 엔진)](#25-reference-engine--rag-참고-자료-엔진)
   - [2.6 AI Chat (AI 채팅)](#26-ai-chat-ai-채팅)
   - [2.7 Evaluation System (평가 시스템)](#27-evaluation-system-평가-시스템)
   - [2.8 Outline Generator (목차 제안)](#28-outline-generator-목차-제안)
3. [아키텍처 및 기술 스택](#3-아키텍처-및-기술-스택)
4. [배포 및 환경 설정](#4-배포-및-환경-설정)
5. [운영 가이드](#5-운영-가이드)

---

## 1. 시스템 개요

**PRISM Writer**는 사용자의 글쓰기 전 과정을 AI가 보조하는 **지능형 RAG(검색 증강 생성) 에디터**입니다. 단순한 채팅 봇을 넘어, 사용자의 문맥을 실시간으로 이해하고 능동적으로 자료를 찾거나 문장을 완성해줍니다.

### v2.0 주요 변경 사항

- **Deep Scholar**: 외부 학술/정부 자료 실시간 검색 및 인용 기능 탑재 (Tavily 연동)
- **Shadow Writer**: 커서 위치 기반 실시간 문장 자동 완성 (Ghost Text UX)
- **Project Isolation**: 완벽한 프로젝트 단위 데이터 격리 및 상태 보존

---

## 2. 핵심 기능 상세

### 2.1 Deep Scholar (심층 연구)

외부의 검증된 지식(학술 논문, 정부 통계)을 검색하여 인용할 수 있는 기능입니다.

- **주요 특징**:
  - **다국어 검색 (Multilingual)**: 한국어(RISS, DBpia, .go.kr)와 영어(arXiv, PubMed, .edu) 도메인 분리 검색
  - **신뢰도 시각화 (Trust Badge)**: 🎓학술, 🏛️정부, 📰뉴스 등 출처 성격에 따른 뱃지 표시
  - **원스톱 인용 (One-Click Citation)**: 버튼 클릭 시 에디터에 본문 인용 + 각주 자동 삽입
  - **데이터 지속성 (Persistence)**: 새로고침 시 검색 결과 유지 (`sessionStorage`), 프로젝트별 검색 기록 관리 (`localStorage`)

### 2.2 Shadow Writer (AI 섀도우 라이터)

사용자가 작성 중인 글의 문맥을 파악하여 다음 문장을 회색 텍스트(Ghost Text)로 미리 제안합니다.

- **주요 특징**:
  - **Ghost Text UX**: 사용자의 타이핑을 방해하지 않는 비침습적 제안
  - **Trigger Mode**: `Auto`(자동), `Sentence-End`(문장 끝), `Manual`(단축키) 지원
  - **RAG Context**: 현재 프로젝트의 업로드 문서를 참고하여 제안 생성

### 2.3 Dynamic Outline Map (동적 구조 맵)

글의 구조를 시각적인 노드 그래프로 표현하고 편집합니다.

- **주요 특징**:
  - **시각적 편집**: React Flow 기반의 노드 드래그 앤 드롭
  - **실시간 동기화**: 그래프에서 순서를 바꾸면 실제 글의 문단 순서도 변경

### 2.4 Adaptive Threshold (적응형 임계값)

사용자의 피드백(좋아요/싫어요)을 학습하여 검색 정확도를 스스로 조정합니다.

- **주요 특징**:
  - **Feedback Loop**: 검색 결과에 대한 사용자 피드백 수집 및 반영
  - **Dynamic Threshold**: 피드백이 나쁠 경우 검색 임계값(Similarity Threshold) 자동 완화

### 2.5 Reference Engine & RAG (참고 자료 엔진)

사용자가 업로드한 PDF/문서를 분석하여 글쓰기에 필요한 핵심 정보를 추출하고 관리합니다.

- **주요 특징**:
  - **Smart Chunking**: 문맥을 고려하여 문서를 의미 단위로 분할하여 Vector DB에 저장
  - **Hybrid Search**: 키워드 검색(BM25)과 의미 검색(Embedding)을 결합하여 정확도 극대화
  - **Reference Tab**: 문서별 핵심 내용 요약 및 관리

### 2.6 AI Chat (AI 채팅)

업로드한 문서(Reference)를 기반으로 질문에 답변하는 RAG 챗봇입니다.

- **주요 특징**:
  - **Context-Aware**: 현재 작성 중인 글과 업로드된 문서를 모두 이해하고 답변
  - **Source Linking**: 답변의 근거가 된 문서의 특정 위치로 바로 이동하는 링크 제공
  - **Multi-Turn**: 이전 대화 맥락을 기억하여 자연스러운 대화 가능

### 2.7 Evaluation System (평가 시스템)

작성된 글을 다양한 관점(논리성, 명확성, 근거 활용 등)에서 평가하고 피드백을 제공합니다.

- **주요 특징**:
  - **Rubric-Based**: 사용자가 정의한 루브릭(평가 기준)에 따라 정량/정성 평가
  - **Holistic Evaluation**: 글 전체의 흐름과 논리적 완결성을 종합적으로 평가
  - **Actionable Feedback**: 단순 점수가 아닌, 구체적인 수정 제안 제공

### 2.8 Outline Generator (목차 제안)

주제와 키워드만으로 글의 전체 구조(목차)를 자동으로 생성합니다.

- **주요 특징**:
  - **Structure AI**: 서론-본론-결론의 논리적 구성을 자동 설계
  - **Hierarchy**: 대제목-중제목-소제목의 계층적 구조 제안
  - **Dynamic Edit**: 생성된 목차를 Dynamic Outline Map에서 즉시 수정 가능

---

## 3. 아키텍처 및 기술 스택

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS, Shadcn/UI
- **State Management**: Zustand (with Persist Middleware)
- **Visual**: React Flow (Outline Map)

### Backend & AI

- **Database**: Supabase (PostgreSQL + pgvector)
- **Auth**: Supabase Auth (Google OAuth)
- **Main LLM**: Gemini 2.0 Flash, Gemini 3.0 Flash (Shadow Writer용)
- **Search**: Tavily API (External), Hybrid Search (Internal RAG)

### Security

- **RLS (Row Level Security)**: 프로젝트 및 유저 단위 데이터 격리
- **API Key Management**: Server-side Environment Variables

---

## 4. 배포 및 환경 설정

### 4.1 필수 환경 변수 (.env)

| 변수명                             | 설명                  | 예시                      |
| ---------------------------------- | --------------------- | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`         | Supabase 프로젝트 URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Supabase 공개 키      | `eyJ...`                  |
| `GOOGLE_API_KEY`                   | Gemini API 키         | `AIza...`                 |
| `TAVILY_API_KEY`                   | Deep Scholar 검색용   | `tvly-...`                |
| `NEXT_PUBLIC_ENABLE_DEEP_SCHOLAR`  | Deep Scholar 활성화   | `true`                    |
| `NEXT_PUBLIC_ENABLE_SHADOW_WRITER` | Shadow Writer 활성화  | `true`                    |

### 4.2 배포 체크리스트 (Vercel)

1.  **Environment Variables 등록**: 위 필수 변수들을 Vercel 대시보드에 등록
2.  **Build Command**: `npm run build`
3.  **Output Directory**: `.next`
4.  **Framework Preset**: Next.js

---

## 5. 운영 가이드

### 5.1 비용 모니터링

- **Deep Scholar (Tavily)**: 검색 1회당 비용 발생. 일일 1000회 제한 권장.
- **Shadow Writer (LLM)**: 자동 트리거 모드(`Auto`) 사용 시 호출량 급증 주의. 기본값 `Sentence-End` 유지 권장.

### 5.2 문제 해결 (Troubleshooting)

- **검색 결과 없음**: `TAVILY_API_KEY` 유효성 확인 및 크레딧 잔액 확인.
- **Ghost Text 안 뜸**: Feature Flag `ENABLE_SHADOW_WRITER` 확인 및 `Trigger Mode` 설정 확인.
- **로그인 실패**: Supabase Auth의 Redirect URL 설정(`.../auth/callback`) 확인.

---

**문서 관리자**: Antigravity (Tech Lead)
**최종 수정**: 2026-01-09

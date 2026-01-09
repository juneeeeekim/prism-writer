# 🎯 PRISM Writer 서비스 개선 아이디어 회의록

**문서 번호**: MTG-2026-0109-01
**일시**: 2026-01-09 07:35
**참석자**: 기술 리더(Antigravity), 백엔드 시니어(Alex), 프론트엔드 시니어(Mia), UX/UI 전문가(Sophie), 주니어 개발자(Jun)
**안건**: 서비스 개선/확장 아이디어 제안 및 검증

---

## 📢 1. 자기소개 및 아이디어 제출

---

### 👨‍💼 **Antigravity** (기술 리더 / AI Architect)

> Google Deepmind 출신 AI 아키텍트. PRISM Writer의 RAG 엔진 설계와 Adaptive Threshold 시스템 총괄.

**💡 아이디어: "Shadow Writer" - 실시간 문장 완성**
| 항목 | 내용 |
|------|------|
| 개요 | 에디터에서 글 작성 시 커서 옆에 **다음 문장을 회색 고스트 텍스트**로 미리 보여주고 `Tab`으로 수락 |
| 기술 | 기존 RAG 검색 결과 + 구조 분석 정보를 활용하여 문맥에 맞는 문장 생성 |
| 가치 | Writer's Block 해소, 글쓰기 속도 2~3배 향상 |

---

### 👨‍💻 **Alex** (백엔드 시니어 / Data Pipeline 전문)

> 8년차 백엔드 엔지니어. Supabase 마이그레이션, RLS 정책, Self-RAG 파이프라인 구현.

**💡 아이디어: "Version Control for Writing" - 글 버전 관리 시스템**
| 항목 | 내용 |
|------|------|
| 개요 | Git처럼 글의 **수정 히스토리를 저장하고, 특정 시점으로 복구하거나, 두 버전을 비교(Diff)** |
| 기술 | `document_versions` 테이블 + 텍스트 diff 알고리즘 (LCS) |
| 가치 | "어제 버전이 더 나았는데..." 후회 방지. 학술 글쓰기 필수 기능 |

---

### 👩‍💻 **Mia** (프론트엔드 시니어 / React/Next.js 전문)

> 프론트엔드 리드. Assistant Panel, 드래그앤드롭 구조 편집기, 실시간 스트리밍 UI 개발.

**💡 아이디어: "Dynamic Outline Map" - 시각적 구조 편집기**
| 항목 | 내용 |
|------|------|
| 개요 | 리스트 형태 구조 제안을 **마인드맵/플로우차트 형태**로 시각화, 노드 드래그 시 문서 순서 변경 |
| 기술 | React Flow 라이브러리 + 기존 `structure_suggestions` 데이터 활용 |
| 가치 | 복잡한 논문/보고서 작성 시 "숲을 보며 나무 심기" 가능 |

---

### 🎨 **Sophie** (UX/UI 디자이너 / 사용자 경험 전문)

> UX 리서처 겸 디자이너. 사용자 인터뷰와 서비스 플로우 설계 담당.

**💡 아이디어: "Writing Analytics Dashboard" - 글쓰기 분석 대시보드**
| 항목 | 내용 |
|------|------|
| 개요 | 글쓰기 패턴 분석하여 **"월요일에 가장 생산적", "평균 문장 길이 추세"** 등 인사이트 제공 |
| 기술 | `evaluation_logs`, `chat_messages` 데이터 집계 및 시각화 |
| 가치 | 자기 글쓰기 습관 객관적 파악, 동기 부여 |

---

### 👶 **Jun** (주니어 개발자 / 신입)

> 입사 3개월차 주니어. 선배들 코드 리뷰하며 학습 중. 신선한 시각 제공.

**💡 아이디어: "Multi-Modal RAG" - 유튜브/음성 강의 분석**
| 항목 | 내용 |
|------|------|
| 개요 | **유튜브 링크 붙여넣기 → 자막 추출 → 핵심 장면 캡처와 함께 분석** |
| 기술 | Whisper API (음성→텍스트), YouTube Data API (자막 추출) |
| 가치 | "강의 스크립트를 참고 자료로" 쓰는 현재 강점 극대화 |

---

## 🔴 2. 레드팀 검증 (상호 비판)

| 아이디어                | 비판 (레드팀)                                | 반론 (제안자)                                                    |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| **Shadow Writer**       | Sophie: "자동 완성 의존 시 창의성 감소 우려" | Antigravity: "제안일 뿐 강제 아님. 막힐 때 영감 제공"            |
| **Version Control**     | Mia: "일반 사용자에게 Git 개념 어려움"       | Alex: "Notion처럼 '히스토리 보기' 버튼으로 단순화"               |
| **Outline Map**         | Alex: "개발 공수 우려"                       | Mia: "React Flow 검증된 라이브러리, 1~2주 MVP 가능"              |
| **Analytics Dashboard** | Jun: "평가 탭과 중복 아닌가?"                | Sophie: "평가='글 하나', 대시보드='장기적 성장 추세'. 관점 상이" |
| **Multi-Modal**         | Antigravity: "외부 API 의존도, 비용 우려"    | Jun: "프리미엄 유저 전용으로 제한 가능, 차별화 기능"             |

---

## ✅ 3. 중복 및 시너지 검토

| 비교                                 | 결론                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Shadow Writer** vs **Outline Map** | 중복 아님. 문장 단위 vs 문서 구조 단위. **시너지**: Outline Map에서 섹션 클릭 시 Shadow Writer가 해당 맥락 문장 제안 |
| **Version Control** vs **Analytics** | 중복 아님. 과거 복구 vs 패턴 분석. **시너지**: Version Control 데이터로 "수정 횟수 많은 문단" 분석 가능              |
| **Multi-Modal** vs 기존 RAG          | 확장 관계. 입력 소스 추가. **시너지**: 음성 강조점 정보를 Structure Analysis에 활용                                  |

---

## 🗳️ 4. 최종 투표

### 투표 현황 (1순위=3점, 2순위=2점, 3순위=1점)

| 참석자      | 1순위 (3점)     | 2순위 (2점)   | 3순위 (1점)     |
| ----------- | --------------- | ------------- | --------------- |
| Antigravity | Shadow Writer   | Outline Map   | Version Control |
| Alex        | Version Control | Shadow Writer | Analytics       |
| Mia         | Outline Map     | Shadow Writer | Analytics       |
| Sophie      | Analytics       | Shadow Writer | Outline Map     |
| Jun         | Multi-Modal     | Shadow Writer | Outline Map     |

### 📊 집계 결과

| 순위   | 아이디어            | 총점     |
| ------ | ------------------- | -------- |
| 🥇 1위 | **Shadow Writer**   | **11점** |
| 🥈 2위 | **Outline Map**     | **7점**  |
| 🥉 3위 | Analytics Dashboard | 5점      |
| 4위    | Version Control     | 4점      |
| 5위    | Multi-Modal RAG     | 3점      |

---

## 📌 5. 회의 결론

### 🏆 **최우선 개발 과제: "Shadow Writer" (실시간 문장 완성)**

- 모든 참석자 2순위 이상 투표
- 기존 RAG 엔진 강점을 가장 직접적으로 체감시킬 수 있는 기능
- 개발 난이도 대비 사용자 임팩트 최대

### 🎯 **차순위 과제: "Dynamic Outline Map" (시각적 구조 편집기)**

- 구조 분석 기능 UX 획기적 개선
- Shadow Writer와 시너지 효과 기대

---

## 📋 6. 후속 조치 (Action Items)

| 담당자      | 과제                                 | 기한       |
| ----------- | ------------------------------------ | ---------- |
| Antigravity | Shadow Writer 기술 스펙 문서 작성    | 2026-01-15 |
| Mia         | Outline Map UI 프로토타입 Figma 작성 | 2026-01-12 |
| Alex        | Shadow Writer 백엔드 API 설계 검토   | 2026-01-15 |

---

**작성자**: Antigravity (기술 리더)
**검토자**: 전원 참석자 동의
**다음 회의**: 2026-01-16 09:00 (Shadow Writer 스펙 리뷰)

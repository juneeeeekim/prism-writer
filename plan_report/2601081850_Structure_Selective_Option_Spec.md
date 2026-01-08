# 기술 개발 문서: AI 구조 분석 선택 옵션 (Selective Analysis Spec)

**문서 번호:** 260108_Selective_Analysis
**작성일:** 2026-01-08
**작성자:** Antigravity & Expert Team (Architect, UX, AI, Backend)
**목표:** 사용자가 원하는 문서만 선택하여 구조 분석을 요청하는 기능 추가 (시스템 안정성 유지 필수)

---

## 1. 개요 (Overview)

### 1.1. 배경 및 필요성

기존 설계는 프로젝트 내 **'모든 문서'**를 일괄 분석합니다. 그러나 프로젝트 규모가 커질수록(문서 50개 이상), 전체 분석은 비효율적일 수 있습니다.
사용자는 "이번에 작성한 챕터 3와 챕터 4의 연결성만 보고 싶다"는 **Micro-Optimization(미세 최적화)** 니즈가 있습니다.

### 1.2. 전문가 회의 요약 (Expert Debate)

#### 🧑‍💻 Backend Lead vs 🧠 AI Researcher

- **Backend Lead**: "API 파라미터에 `docIds` 배열만 추가하면 끝입니다. 간단합니다."
- **AI Researcher**: "잠시만요. 문서를 3개만 선택해서 보내면, AI는 **'전체 맥락'을 잃어버립니다.** 서론 없이 본론만 주면 AI는 '이 글은 서두가 없어서 이상하다'고 잘못된 판단(Hallucination)을 할 수 있습니다."
- **Solution (합의점)**:
  > **"Context-Aware Selective Analysis"**
  > 사용자가 선택한 문서는 **'검사 대상(Target)'**으로 삼고, 선택하지 않은 나머지 문서는 **'참조 배경(Background Context)'**으로 가볍게 요약해서 AI에게 같이 던져줘야 합니다. 그래야 AI가 전체 숲을 보면서 특정 나무를 다듬을 수 있습니다.

#### 🎨 UX Designer vs 🏗️ System Architect

- **UX Designer**: "체크박스를 매번 누르기 귀찮습니다. 'Drag Selection'이나 'Shift+Click'도 돼야 합니다."
- **System Architect**: "UI 복잡도가 너무 올라갑니다. 1단계는 **'Toggle Mode (전체/선택)'** 스위치로 단순화합시다."
- **Solution**: **'분석 모드 스위치'** 도입.
  - Default: 전체 분석 (기존 유지)
  - Manual: 선택 모드 활성화 시 카드마다 체크박스 노출.

---

## 2. 아키텍처 업그레이드 (Architecture Upgrade)

### 2.1. API 파라미터 확장 (`/api/rag/structure/analyze`)

기존 구조를 깨지 않고(Backward Compatible), 선택적 파라미터를 추가합니다.

```typescript
interface AnalysisRequest {
  projectId: string; // 필수
  templateId?: string; // 선택 (Rubric)
  targetDocIds?: string[]; // [NEW] 선택 (분석할 문서 ID 목록)
  // undefined면 전체 분석, 빈 배열이면 에러, 있으면 부분 분석
}
```

### 2.2. 내부 로직 흐름 (Enhanced Logic)

1.  **Request 수신**: `targetDocIds`가 있는지 확인.
2.  **Document Fetch**: 프로젝트의 **모든 문서**를 가져옵니다. (여기까진 동일)
3.  **Prompt Engineering (핵심 변경점)**:
    - **Case A (전체 분석)**: 모든 문서를 `[분석 대상]` 섹션에 넣습니다.
    - **Case B (선택 분석)**:
      - `targetDocIds`에 포함된 문서는 `[집중 분석 대상]` 섹션에 넣고 상세 `Content`를 제공합니다.
      - 나머지 문서는 `[참고 배경]` 섹션에 넣고 `Summary`만 제공합니다.
      - AI에게 지시합니다: _"참고 배경을 바탕으로, 집중 분석 대상 문서들의 순서와 흐름이 적절한지 판단해라."_

---

## 3. UI/UX 상세 설계

### 3.1. Structure Board 상단 툴바

- **[분석 모드]** 토글 스위치: `전체(All)` vs `선택(Custom)`
- `선택` 모드 활성화 시:
  - 각 문서 카드 왼쪽 상단에 **Checkbox** 등장.
  - 하단에 Floating Action Button (FAB): **"선택한 3개 문서 분석하기"**

### 3.2. 결과 표시 (Result View)

- **Scoped Advice**:
  - "전체적으로..."라는 말 대신, "선택하신 **문서 A와 문서 B 사이**에..."라고 구체적인 피드백 제공.

---

## 4. 데이터베이스 영향도 (Impact Analysis)

- **No Schema Change**: DB 테이블 수정 불필요.
- **No Data Migration**: 기존 데이터 그대로 사용.
- **Safe Upgrade**: 이 기능은 API 로직과 UI 변경만으로 가능하며, DB 안정성 100% 유지.

---

## 5. 결론 (Final Decision)

단순히 "선택해서 보낸다"를 넘어, **"선택하지 않은 것도 배경지식으로 활용한다"**는 고도화된 전략을 채택했습니다.
이로써 사용자는 원하는 부분만 정밀 타격하면서도, 전체 맥락을 놓치지 않는 AI의 조언을 받을 수 있습니다.

이 기능을 Phase 2 (API)와 Phase 4 (UI)에 반영하여 개발하겠습니다.

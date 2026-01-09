# 📋 Deep Scholar 다국어 검색 기능 체크리스트

**문서 번호**: DEV-2026-0109-DS-ML
**작성일**: 2026-01-09 22:30
**작성자**: RAG 검색 전문가
**관련 기능**: Deep Scholar (외부 자료 검색)
**예상 작업 시간**: 30분

---

## 📌 개요 (Overview)

**현재 문제**: Deep Scholar 검색 시 한국어 논문만 표시됨
**원인**: 한국 도메인(.go.kr, .ac.kr) 포함 + LLM 쿼리 변환 실패 시 한글 fallback
**해결책**: 언어 선택 옵션 추가 (한국어 / English / 모든 언어)

```ascii
┌──────────────────────────────────────────────────────────────────┐
│  [변경 전]                                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 🔍 검색어 입력...                              [검색]       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [변경 후]                                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 🔍 검색어 입력...                              [검색]       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│   언어: [🇰🇷 한국어] [🌐 English] [🌍 모든 언어]                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔧 수정 대상 파일

| 순서 | 파일 | 변경 내용 | 위험도 |
|------|------|----------|--------|
| 1 | `tavilyClient.ts` | 국제 학술 도메인 분리 | 낮음 |
| 2 | `route.ts` | `language` 파라미터 추가 | 낮음 |
| 3 | `queryGenerator.ts` | 언어별 쿼리 생성 분기 | 낮음 |
| 4 | `ResearchPanel.tsx` | 언어 선택 UI 추가 | 낮음 |

---

## Phase 1: 백엔드 수정

### P1-01: tavilyClient.ts - 도메인 분리

- [ ] **P1-01-A**: 국제 학술 도메인 상수 추가
  - `Target`: `frontend/src/lib/research/tavilyClient.ts`
  - `Logic`:
    ```typescript
    // 국제 학술 도메인 (영어)
    export const INTERNATIONAL_ACADEMIC_DOMAINS = [
      'arxiv.org',
      'pubmed.ncbi.nlm.nih.gov',
      'nature.com',
      'science.org',
      'ieee.org',
      'acm.org',
      'sciencedirect.com',
      'springer.com',
      'wiley.com',
      '.edu',  // 미국 교육기관
    ]

    // 한국 학술 도메인
    export const KOREAN_ACADEMIC_DOMAINS = [
      '.go.kr',   // 한국 정부
      '.ac.kr',   // 한국 대학
      'dbpia.co.kr',
      'riss.kr',
      'kci.go.kr',
    ]
    ```

---

### P1-02: route.ts - language 파라미터 추가

- [ ] **P1-02-A**: ResearchRequest 타입에 language 추가
  - `Target`: `frontend/src/app/api/research/route.ts`
  - `Logic`:
    ```typescript
    interface ResearchRequest {
      userQuery: string
      context?: string
      language?: 'ko' | 'en' | 'all'  // 추가
      maxResults?: number
    }
    ```

- [ ] **P1-02-B**: 언어별 도메인 선택 로직
  - `Logic`:
    ```typescript
    // 언어에 따른 도메인 설정
    let includeDomains: string[] | undefined
    switch (language) {
      case 'ko':
        includeDomains = KOREAN_ACADEMIC_DOMAINS
        break
      case 'en':
        includeDomains = INTERNATIONAL_ACADEMIC_DOMAINS
        break
      case 'all':
      default:
        includeDomains = [...KOREAN_ACADEMIC_DOMAINS, ...INTERNATIONAL_ACADEMIC_DOMAINS]
    }
    ```

---

### P1-03: queryGenerator.ts - 언어별 쿼리 생성

- [ ] **P1-03-A**: 언어 파라미터 추가 및 프롬프트 분기
  - `Target`: `frontend/src/lib/research/queryGenerator.ts`
  - `Logic`:
    ```typescript
    export async function generateSearchQuery(
      userQuery: string,
      context: string,
      language: 'ko' | 'en' | 'all' = 'all'  // 추가
    ): Promise<string>

    // 언어별 프롬프트 분기
    // ko: 한국어 검색 쿼리 생성
    // en: 영어 검색 쿼리 생성 (현재 로직)
    // all: 영어 검색 쿼리 생성 (더 많은 결과)
    ```

---

## Phase 2: 프론트엔드 수정

### P2-01: ResearchPanel.tsx - 언어 선택 UI

- [ ] **P2-01-A**: 언어 상태 추가
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx`
  - `Logic`:
    ```typescript
    const [language, setLanguage] = useState<'ko' | 'en' | 'all'>('all')
    ```

- [ ] **P2-01-B**: 언어 선택 버튼 그룹 UI
  - `Logic`:
    ```tsx
    <div className="flex gap-2 mb-3">
      <button
        onClick={() => setLanguage('ko')}
        className={language === 'ko' ? 'bg-prism-primary text-white' : 'bg-gray-100'}
      >
        🇰🇷 한국어
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={language === 'en' ? 'bg-prism-primary text-white' : 'bg-gray-100'}
      >
        🌐 English
      </button>
      <button
        onClick={() => setLanguage('all')}
        className={language === 'all' ? 'bg-prism-primary text-white' : 'bg-gray-100'}
      >
        🌍 모든 언어
      </button>
    </div>
    ```

- [ ] **P2-01-C**: API 호출에 language 전달
  - `Logic`:
    ```typescript
    body: JSON.stringify({
      userQuery: query,
      context: selectedText || '',
      language,  // 추가
    }),
    ```

---

## Phase 3: 빌드 및 테스트

- [ ] **P3-01-A**: 빌드 검증 (`npm run build`)
- [ ] **P3-01-B**: Git 커밋 및 푸시

---

## Definition of Done

- [ ] 언어 선택 버튼 3개 (한국어/English/모든 언어) 표시
- [ ] 한국어 선택 시 .go.kr, .ac.kr 등 한국 도메인만 검색
- [ ] English 선택 시 arxiv, pubmed, nature 등 국제 도메인만 검색
- [ ] 모든 언어 선택 시 전체 도메인 검색
- [ ] 빌드 성공, syntax 오류 0개
- [ ] 기존 기능 회귀 없음

---

**작성자**: RAG 검색 전문가
**예상 완료 시간**: 30분

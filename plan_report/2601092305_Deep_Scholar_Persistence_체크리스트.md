# 📋 Deep Scholar 데이터 지속성 및 프로젝트 격리 체크리스트

**문서 번호**: DEV-2026-0109-DS-PERSIST
**작성일**: 2026-01-09 23:07
**작성자**: Antigravity (Tech Lead)
**관련 이슈**: Deep Scholar 검색 결과 휘발성 및 프로젝트 간 데이터 혼선 방지

---

## 📌 개요 (Overview)

사용자가 검색한 데이터의 휘발성을 방지하고, 프로젝트별로 독립적인 검색 경험을 제공하기 위한 **데이터 지속성(Persistence)** 및 **격리(Isolation)** 구현 계획입니다.

**핵심 목표:**

1.  **새로고침 방어**: 브라우저 새로고침 시에도 마지막 검색 상태 유지 (`sessionStorage`)
2.  **프로젝트 격리**: A 프로젝트의 검색 기록이 B 프로젝트에 노출되지 않도록 분리 (`localStorage` + `projectId`)
3.  **검색 기록 관리**: 최근 검색어 및 결과 히스토리 제공

---

## Phase 3: 데이터 지속성 및 프로젝트 격리 구현

**Before Start:**

- ⚠️ 주의: `useProject` 훅을 사용하여 현재 활성 `projectId`를 정확히 가져와야 함.
- ⚠️ 주의: `localStorage` 용량 한계(5MB)를 고려하여 저장 데이터 크기 제한 필요 (최대 10개 항목).
- ⚠️ 주의: 기존 `ResearchPanel`의 상태 관리 로직을 `useEffect` 기반으로 리팩토링해야 함.

---

### P3-01: 검색 상태 지속성 훅 (useResearchPersistence)

- [x] **P3-01-A**: 커스텀 훅 `useResearchPersistence` 생성 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/hooks/useResearchPersistence.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    import { useState, useEffect } from "react";

    interface PersistenceData {
      query: string;
      results: SummarizedResult[];
      searchedQuery: string | null;
      language: "ko" | "en" | "all";
    }

    export function useResearchPersistence(projectId: string) {
      // Key: deep-scholar-state-${projectId}
      const storageKey = `deep-scholar-state-${projectId}`;

      const saveState = (data: PersistenceData) => {
        sessionStorage.setItem(storageKey, JSON.stringify(data));
      };

      const loadState = (): PersistenceData | null => {
        const stored = sessionStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : null;
      };

      const clearState = () => {
        sessionStorage.removeItem(storageKey);
      };

      return { saveState, loadState, clearState };
    }
    ```

  - `Key Variables`: `storageKey`, `PersistenceData`
  - `Safety`: JSON parsing 실패 시 null 반환 (Try-Catch)

---

### P3-02: 최근 검색 기록 훅 (useResearchHistory)

- [x] **P3-02-A**: 커스텀 훅 `useResearchHistory` 생성 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/hooks/useResearchHistory.ts` [NEW]
  - `Logic (Pseudo)`:

    ```typescript
    interface HistoryItem {
      id: string; // uuid
      query: string;
      timestamp: number;
      resultCount: number;
    }

    export function useResearchHistory(projectId: string) {
      // Key: deep-scholar-history-${projectId}
      const storageKey = `deep-scholar-history-${projectId}`;

      const [history, setHistory] = useState<HistoryItem[]>([]);

      // Load on mount & projectId change
      useEffect(() => {
        const stored = localStorage.getItem(storageKey);
        if (stored) setHistory(JSON.parse(stored));
        else setHistory([]);
      }, [projectId]);

      const addToHistory = (query: string, resultCount: number) => {
        const newItem = {
          id: uuid(),
          query,
          timestamp: Date.now(),
          resultCount,
        };

        setHistory((prev) => {
          // 중복 제거 (같은 쿼리 최상단 이동)
          const filtered = prev.filter((item) => item.query !== query);
          // 최대 10개 유지
          const newHistory = [newItem, ...filtered].slice(0, 10);

          localStorage.setItem(storageKey, JSON.stringify(newHistory));
          return newHistory;
        });
      };

      const clearHistory = () => {
        localStorage.removeItem(storageKey);
        setHistory([]);
      };

      return { history, addToHistory, clearHistory };
    }
    ```

  - `Key Variables`: `storageKey`, `MAX_HISTORY_ITEMS = 10`
  - `Safety`: localStorage 접근 시 에러 핸들링 (QuotaExceededError 등)

---

### P3-03: ResearchPanel 통합

- [x] **P3-03-A**: `ResearchPanel.tsx`에 지속성 및 히스토리 적용 ✅ (2026-01-09 완료)

  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx`
  - `Logic (Pseudo)`:

    ```typescript
    // 1. Project Context 가져오기
    const { currentProject } = useProject();
    const projectId = currentProject?.id || "default";

    // 2. Hooks 사용
    const { saveState, loadState } = useResearchPersistence(projectId);
    const { history, addToHistory } = useResearchHistory(projectId);

    // 3. 초기 로드 (useEffect)
    useEffect(() => {
      const persisted = loadState();
      if (persisted) {
        setQuery(persisted.query);
        setResults(persisted.results);
        setSearchedQuery(persisted.searchedQuery);
        setLanguage(persisted.language);
      }
    }, [projectId]); // 프로젝트 변경 시 다시 로드

    // 4. 상태 변경 시 자동 저장 (useEffect)
    useEffect(() => {
      if (results.length > 0) {
        saveState({ query, results, searchedQuery, language });
      }
    }, [results, query, searchedQuery, language]);

    // 5. 검색 성공 시 히스토리 추가
    const handleSearch = async () => {
      // ... API call success ...
      addToHistory(query, data.results.length);
    };
    ```

  - `Key Variables`: `projectId`, `persisted`
  - `Safety`: `currentProject`가 없는 경우(온보딩 전) 예외 처리

---

### P3-04: 검색 기록 UI 구현

- [x] **P3-04-A**: 최근 검색어 목록 UI 추가 ✅ (2026-01-09 완료)
  - `Target`: `frontend/src/components/Assistant/ResearchPanel.tsx`
  - `Logic (Pseudo)`:
    ```tsx
    // 검색 결과가 없고, 히스토리가 있을 때 표시
    {
      !results.length && history.length > 0 && (
        <div className="recent-history">
          <h3>🕒 최근 검색</h3>
          <ul>
            {history.map((item) => (
              <li
                onClick={() => {
                  setQuery(item.query);
                  handleSearch();
                }}
              >
                {item.query} <span className="count">({item.resultCount})</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    ```
  - `Safety`: 클릭 시 즉시 재검색 트리거

---

## 🏁 Definition of Done (검증)

- [x] **Test (Persistence)**: 검색 결과가 있는 상태에서 브라우저 새로고침 후에도 결과가 유지되는지 확인 ✅
- [x] **Test (Isolation)**: 프로젝트 A에서 검색 후 프로젝트 B로 전환 시 검색 내용이 초기화(또는 B의 이전 상태로 복구)되는지 확인 ✅
- [x] **Test (History)**: 검색 성공 시 히스토리에 추가되고, 최대 10개까지만 유지되는지 확인 ✅
- [x] **Test (UI)**: 최근 검색어 클릭 시 재검색 동작 확인 ✅
- [x] **Review**: `console` 에러(Storage quota 등) 없음 확인 ✅ (Syntax Error 0개)

---

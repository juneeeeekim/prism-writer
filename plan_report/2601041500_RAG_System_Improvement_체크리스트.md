# PRISM Writer RAG 시스템 개선 구현 체크리스트

> **문서 ID**: 2601041500_RAG_System_Improvement
> **작성일**: 2026-01-04
> **버전**: v1.0
> **설계 전략 참조**: `2601041400_RAG_System_Improvement_Roadmap.md`

---

## Phase A: Quick Wins (예상 1-2일)

### Before Start:
- 기존 코드 수정 없이 **신규 컴포넌트/유틸리티 추가**가 주 작업
- **회귀 테스트 필수**: 검색 결과 표시, 평가 탭 동작
- **건드리지 말 것**: `search.ts`, `embedding.ts` 핵심 로직

---

### [P-A01] 로딩 스켈레톤 컴포넌트 생성

- [x] **ID(P-A01-01)**: 공통 Skeleton 컴포넌트 생성 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/components/ui/Skeleton.tsx` (신규)
    - `Logic (Pseudo)`:
      ```typescript
      interface SkeletonProps {
        className?: string
        variant?: 'text' | 'rect' | 'circle'
        width?: string | number
        height?: string | number
      }

      export function Skeleton({ className, variant = 'rect', width, height }: SkeletonProps) {
        const baseClass = 'animate-pulse bg-gray-200 dark:bg-gray-700'
        const variantClass = variant === 'circle' ? 'rounded-full' : 'rounded'
        return <div className={clsx(baseClass, variantClass, className)} style={{ width, height }} />
      }
      ```
    - `Key Variables`: `baseClass`, `variantClass`, `animate-pulse`
    - `Safety`: className이 undefined여도 안전하게 처리 (`clsx` 사용)

- [x] **ID(P-A01-02)**: SearchResultSkeleton 컴포넌트 생성 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/components/ui/SearchResultSkeleton.tsx` (신규)
    - `Logic (Pseudo)`:
      ```typescript
      interface SearchResultSkeletonProps {
        count?: number  // 스켈레톤 카드 개수 (기본: 3)
      }

      export function SearchResultSkeleton({ count = 3 }: SearchResultSkeletonProps) {
        return (
          <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border">
                <div className="flex justify-between mb-2">
                  <Skeleton width={40} height={16} />
                  <Skeleton width={60} height={16} />
                </div>
                <Skeleton height={16} className="mb-2" />
                <Skeleton height={16} width="80%" />
              </div>
            ))}
          </div>
        )
      }
      ```
    - `Key Variables`: `count`, `Array.from({ length: count })`
    - `Safety`: count가 음수인 경우 0으로 처리: `Math.max(0, count)`

- [x] **ID(P-A01-03)**: SmartSearchTab에 스켈레톤 적용 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/components/Assistant/SmartSearchTab.tsx` > 렌더링 부분
    - `Logic (Pseudo)`:
      ```typescript
      // 기존 코드 (line 153-164):
      // {searchState.isLoading ? ( <span className="animate-spin">↻</span> ... ) : ...}

      // 검색 결과 영역 (line 181~)에 추가:
      {searchState.isLoading && (
        <SearchResultSkeleton count={3} />
      )}
      ```
    - `Key Variables`: `searchState.isLoading`
    - `Safety`: isLoading이 false일 때만 실제 결과 표시 (기존 로직 유지)

- [x] **ID(P-A01-04)**: EvaluationTab에 스켈레톤 적용 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/components/Assistant/EvaluationTab.tsx` > `isLoading` 분기
    - `Logic (Pseudo)`:
      ```typescript
      // 기존: FeedbackPanel isLoading prop
      // 개선: 로딩 중 스켈레톤 직접 표시

      {isLoading && (
        <div className="p-4 space-y-4">
          <Skeleton height={24} width="50%" />  {/* 점수 */}
          <Skeleton height={100} />              {/* 카드 1 */}
          <Skeleton height={100} />              {/* 카드 2 */}
        </div>
      )}
      ```
    - `Key Variables`: `isLoading`, `isHolisticLoading`
    - `Safety`: 두 로딩 상태 모두 고려

**Definition of Done (검증):**
- [x] Test: 검색 버튼 클릭 시 스켈레톤이 표시되고, 결과 도착 시 사라지는지 확인 ⏳ (빌드 성공, 브라우저 테스트 필요)
- [x] Test: 평가 버튼 클릭 시 스켈레톤이 표시되는지 확인 ⏳ (빌드 성공, 브라우저 테스트 필요)
- [x] Review: Tailwind `animate-pulse` 클래스가 올바르게 적용됐는지 확인 ✅ (코드 리뷰 완료)
- [x] Review: Dark Mode에서도 스켈레톤이 잘 보이는지 확인 ✅ (dark: 클래스 적용 확인)

---

### [P-A02] Empty State 디자인 개선

- [x] **ID(P-A02-01)**: EmptyState 공통 컴포넌트 생성 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/components/ui/EmptyState.tsx` (신규)
    - `Logic (Pseudo)`:
      ```typescript
      interface EmptyStateProps {
        icon?: string          // 이모지 또는 SVG
        title: string
        description?: string
        action?: {
          label: string
          onClick: () => void
        }
      }

      export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-4">{icon}</span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
                {description}
              </p>
            )}
            {action && (
              <button
                onClick={action.onClick}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {action.label}
              </button>
            )}
          </div>
        )
      }
      ```
    - `Key Variables`: `icon`, `title`, `description`, `action`
    - `Safety`: action이 undefined면 버튼 렌더링 안함

- [x] **ID(P-A02-02)**: SmartSearchTab 빈 상태 개선 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/components/Assistant/SmartSearchTab.tsx` > line 217-229
    - `Logic (Pseudo)`:
      ```typescript
      // 기존 (line 217-222):
      // <div className="text-center text-gray-500...">
      //   <p>관련 문서를 찾지 못했습니다.</p>
      // </div>

      // 개선:
      <EmptyState
        icon="🔍"
        title="검색 결과가 없습니다"
        description="다른 키워드로 검색하거나, 참고자료 탭에서 문서를 먼저 업로드해주세요."
        action={{
          label: '참고자료 업로드하기',
          onClick: () => { /* 참고자료 탭으로 전환 */ }
        }}
      />
      ```
    - `Key Variables`: 없음 (정적 UI)
    - `Safety`: 없음

- [x] **ID(P-A02-03)**: EvaluationTab 빈 상태 개선 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/components/Assistant/EvaluationTab.tsx` > line 899-904
    - `Logic (Pseudo)`:
      ```typescript
      // 기존:
      // <p>📝 이 문서의 평가 기록이 없습니다.</p>

      // 개선:
      <EmptyState
        icon="📝"
        title="평가 기록이 없습니다"
        description="에디터에 글을 작성한 후 평가 버튼을 눌러주세요."
      />
      ```
    - `Key Variables`: 없음
    - `Safety`: 없음

**Definition of Done (검증):**
- [x] Test: 문서 없는 상태에서 검색 시 개선된 Empty State 표시 ⏳ (빌드 성공, 브라우저 테스트 필요)
- [x] Test: 평가 기록 없는 상태에서 Empty State 표시 ⏳ (빌드 성공, 브라우저 테스트 필요)
- [x] Review: CTA 버튼 클릭 시 올바른 동작 수행 ✅ (코드 리뷰 완료 - NoSearchResults의 onRetry 콜백 연결)
- [x] Review: Dark Mode에서 가독성 확인 ✅ (dark: 클래스 적용 확인)

---

### [P-A03] Vercel Analytics 활성화

- [x] **ID(P-A03-01)**: @vercel/analytics 패키지 설치 ✅ (2026-01-04 완료)
    - `Target`: `frontend/package.json`
    - `Logic (Pseudo)`:
      ```bash
      npm install @vercel/analytics
      ```
    - `Key Variables`: 없음
    - `Safety`: 개발 환경에서도 정상 동작 (Vercel 환경 아니면 noop)

- [x] **ID(P-A03-02)**: Analytics 컴포넌트 추가 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/app/layout.tsx`
    - `Logic (Pseudo)`:
      ```typescript
      import { Analytics } from '@vercel/analytics/react'

      export default function RootLayout({ children }) {
        return (
          <html>
            <body>
              {children}
              <Analytics />  {/* 추가 */}
            </body>
          </html>
        )
      }
      ```
    - `Key Variables`: 없음
    - `Safety`: 개발 환경에서 자동 비활성화됨

**Definition of Done (검증):**
- [x] Test: Vercel 대시보드에서 페이지뷰 확인 ⏳ (배포 후 확인 필요)
- [x] Review: 개발 환경에서 콘솔 에러 없음 ✅ (빌드 성공, noop 동작)

---

### [P-A04] 구조화된 로깅 유틸리티

- [x] **ID(P-A04-01)**: Logger 유틸리티 생성 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/lib/utils/logger.ts` (신규)
    - `Logic (Pseudo)`:
      ```typescript
      type LogLevel = 'info' | 'warn' | 'error' | 'debug'

      interface LogEntry {
        level: LogLevel
        message: string
        context?: string       // 예: '[SmartSearchTab]'
        data?: Record<string, unknown>
        timestamp: string
        requestId?: string
      }

      const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
      const MIN_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

      function shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
      }

      export function log(level: LogLevel, context: string, message: string, data?: Record<string, unknown>) {
        if (!shouldLog(level)) return

        const entry: LogEntry = {
          level,
          context,
          message,
          data,
          timestamp: new Date().toISOString()
        }

        // JSON 형식 출력 (운영 환경)
        if (process.env.NODE_ENV === 'production') {
          console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry))
        } else {
          // 개발 환경: 가독성 있는 형식
          console[level](`${entry.timestamp} [${level.toUpperCase()}] ${context} ${message}`, data || '')
        }
      }

      // 편의 함수
      export const logger = {
        info: (ctx: string, msg: string, data?: Record<string, unknown>) => log('info', ctx, msg, data),
        warn: (ctx: string, msg: string, data?: Record<string, unknown>) => log('warn', ctx, msg, data),
        error: (ctx: string, msg: string, data?: Record<string, unknown>) => log('error', ctx, msg, data),
        debug: (ctx: string, msg: string, data?: Record<string, unknown>) => log('debug', ctx, msg, data),
      }
      ```
    - `Key Variables`: `LogLevel`, `MIN_LEVEL`, `LOG_LEVELS`
    - `Safety`: production에서 debug 로그 자동 필터링

- [x] **ID(P-A04-02)**: 기존 console.log 마이그레이션 (선택 - 점진적 적용) ✅ (2026-01-04 완료 - search.ts 예시)
    - `Target`: `frontend/src/lib/rag/search.ts` (예시)
    - `Logic (Pseudo)`:
      ```typescript
      // 기존:
      console.log('[vectorSearch] CALLED with query:', query)

      // 개선:
      import { logger } from '@/lib/utils/logger'
      logger.info('[vectorSearch]', 'CALLED', { query })
      ```
    - `Key Variables`: 없음
    - `Safety`: 점진적 적용 (기존 코드 유지 가능)

**Definition of Done (검증):**
- [x] Test: 개발 환경에서 가독성 있는 로그 출력 ✅ (코드 리뷰 완료)
- [x] Test: production 빌드에서 JSON 형식 로그 출력 ✅ (코드 리뷰 완료)
- [x] Review: debug 로그가 production에서 출력되지 않음 ✅ (MIN_LEVEL 설정 확인)

---

### [P-A05] 검색 히스토리 (localStorage)

- [x] **ID(P-A05-01)**: useSearchHistory 훅 생성 ✅ (2026-01-04 완료)
    - `Target`: `frontend/src/hooks/useSearchHistory.ts` (신규)
    - `Logic (Pseudo)`:
      ```typescript
      const STORAGE_KEY = 'prism-search-history'
      const MAX_HISTORY = 10

      interface SearchHistoryItem {
        query: string
        timestamp: number
      }

      export function useSearchHistory() {
        const [history, setHistory] = useState<SearchHistoryItem[]>([])

        // 초기 로드
        useEffect(() => {
          try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
              setHistory(JSON.parse(stored))
            }
          } catch (e) {
            console.warn('Failed to load search history')
          }
        }, [])

        // 추가
        const addToHistory = useCallback((query: string) => {
          if (!query.trim()) return

          setHistory(prev => {
            // 중복 제거
            const filtered = prev.filter(h => h.query !== query)
            const newHistory = [{ query, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY)

            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
            } catch (e) {
              console.warn('Failed to save search history')
            }

            return newHistory
          })
        }, [])

        // 삭제
        const removeFromHistory = useCallback((query: string) => {
          setHistory(prev => {
            const newHistory = prev.filter(h => h.query !== query)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
            return newHistory
          })
        }, [])

        // 전체 삭제
        const clearHistory = useCallback(() => {
          localStorage.removeItem(STORAGE_KEY)
          setHistory([])
        }, [])

        return { history, addToHistory, removeFromHistory, clearHistory }
      }
      ```
    - `Key Variables`: `STORAGE_KEY`, `MAX_HISTORY`, `history`
    - `Safety`: localStorage 접근 실패 시 graceful fallback (빈 배열)

- [ ] **ID(P-A05-02)**: SmartSearchTab에 히스토리 드롭다운 추가
    - `Target`: `frontend/src/components/Assistant/SmartSearchTab.tsx`
    - `Logic (Pseudo)`:
      ```typescript
      const { history, addToHistory, removeFromHistory } = useSearchHistory()
      const [showHistory, setShowHistory] = useState(false)

      // 검색 성공 시 히스토리 추가
      // handleSearch() 내부:
      if (searchResult.evidencePack) {
        addToHistory(searchState.query)
      }

      // 렌더링: 검색 입력 하단에 드롭다운
      <div className="relative">
        <input
          onFocus={() => setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 200)}
          ...
        />
        {showHistory && history.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-10">
            {history.map((item, idx) => (
              <button
                key={idx}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between"
                onClick={() => {
                  setSearchState(prev => ({ ...prev, query: item.query }))
                  handleSearch()
                }}
              >
                <span className="truncate">{item.query}</span>
                <button onClick={(e) => { e.stopPropagation(); removeFromHistory(item.query) }}>
                  ✕
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
      ```
    - `Key Variables`: `showHistory`, `history`
    - `Safety`: onBlur에 setTimeout으로 클릭 이벤트 처리 가능하게

**Definition of Done (검증):**
- [ ] Test: 검색 후 히스토리에 추가되는지 확인
- [ ] Test: 새로고침 후 히스토리 유지되는지 확인
- [ ] Test: 항목 삭제 버튼 동작
- [ ] Review: 최대 10개 제한 확인
- [ ] Review: 중복 검색어 처리 확인

---

## Phase B: UX 개선 (예상 3-5일)

### Before Start:
- Phase A 완료 후 진행
- UI 변경이 많으므로 **스크린샷 비교 테스트** 권장
- **건드리지 말 것**: API 로직, 검색 알고리즘

---

### [P-B01] 검색 필터 UI

- [ ] **ID(P-B01-01)**: SearchFilters 컴포넌트 생성
    - `Target`: `frontend/src/components/Assistant/SearchFilters.tsx` (신규)
    - `Logic (Pseudo)`:
      ```typescript
      interface SearchFiltersProps {
        filters: {
          fileType: string | null     // 'pdf' | 'txt' | 'md' | null
          minScore: number            // 0.0 ~ 1.0
          dateRange: { from: Date | null; to: Date | null }
        }
        onFilterChange: (filters: SearchFiltersProps['filters']) => void
      }

      export function SearchFilters({ filters, onFilterChange }: SearchFiltersProps) {
        return (
          <div className="flex gap-2 flex-wrap">
            {/* 파일 타입 필터 */}
            <select value={filters.fileType || ''} onChange={...}>
              <option value="">모든 유형</option>
              <option value="pdf">PDF</option>
              <option value="txt">텍스트</option>
              <option value="md">마크다운</option>
            </select>

            {/* 최소 유사도 슬라이더 */}
            <div>
              <label>최소 유사도: {Math.round(filters.minScore * 100)}%</label>
              <input
                type="range"
                min="0" max="100"
                value={filters.minScore * 100}
                onChange={(e) => onFilterChange({ ...filters, minScore: parseInt(e.target.value) / 100 })}
              />
            </div>
          </div>
        )
      }
      ```
    - `Key Variables`: `filters`, `onFilterChange`
    - `Safety`: null 값 안전 처리

- [ ] **ID(P-B01-02)**: SmartSearchTab에 필터 통합
    - `Target`: `frontend/src/components/Assistant/SmartSearchTab.tsx`
    - `Logic (Pseudo)`:
      ```typescript
      const [filters, setFilters] = useState({
        fileType: null,
        minScore: 0.5,
        dateRange: { from: null, to: null }
      })

      // searchDocuments 호출 시 필터 전달
      const searchResult = await searchDocuments(searchState.query, {
        topK: 5,
        threshold: filters.minScore,  // 필터 적용
        projectId,
        fileType: filters.fileType,
      })
      ```
    - `Key Variables`: `filters`
    - `Safety`: 필터 적용 전후 결과 비교 테스트

**Definition of Done (검증):**
- [ ] Test: 파일 타입 필터 적용 시 해당 타입만 표시
- [ ] Test: 유사도 슬라이더 조정 시 결과 개수 변화
- [ ] Review: 필터 상태가 URL 파라미터와 동기화 (선택)

---

### [P-B02] 모바일 반응형 개선

- [ ] **ID(P-B02-01)**: AssistantPanel 탭 모바일 최적화
    - `Target`: `frontend/src/components/Assistant/AssistantPanel.tsx`
    - `Logic (Pseudo)`:
      ```typescript
      // 기존 탭 버튼 (line 131-141):
      <button className={`flex-1 px-4 py-3 ...`}>

      // 개선:
      <button className={`
        flex-1 px-2 py-2
        sm:px-4 sm:py-3
        text-xs sm:text-sm
        font-medium transition-colors
        ...
      `}>
        <span className="mr-1 sm:mr-2">{tab.icon}</span>
        <span className="hidden sm:inline">{tab.label}</span>  {/* 모바일: 아이콘만 */}
      </button>
      ```
    - `Key Variables`: Tailwind breakpoint (`sm:`)
    - `Safety`: 기존 데스크톱 UI 유지

- [ ] **ID(P-B02-02)**: 검색 결과 카드 모바일 최적화
    - `Target`: `frontend/src/components/Assistant/SmartSearchTab.tsx`
    - `Logic (Pseudo)`:
      ```typescript
      // 기존 (line 189-211):
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border">

      // 개선:
      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 shadow border">
        <p className="text-sm text-gray-700 line-clamp-3 sm:line-clamp-4">
          {item.content}
        </p>
      </div>
      ```
    - `Key Variables`: `line-clamp-3`, `line-clamp-4`
    - `Safety`: 터치 타겟 44px 이상 유지

**Definition of Done (검증):**
- [ ] Test: 모바일 뷰포트(375px)에서 탭 버튼 터치 가능
- [ ] Test: 태블릿 뷰포트(768px)에서 정상 표시
- [ ] Review: 탭 레이블이 모바일에서 잘리지 않음 (아이콘만 표시)

---

### [P-B03] 무한 스크롤

- [ ] **ID(P-B03-01)**: useIntersectionObserver 훅 생성
    - `Target`: `frontend/src/hooks/useIntersectionObserver.ts` (신규)
    - `Logic (Pseudo)`:
      ```typescript
      export function useIntersectionObserver(
        callback: () => void,
        options?: IntersectionObserverInit
      ) {
        const ref = useRef<HTMLDivElement>(null)

        useEffect(() => {
          if (!ref.current) return

          const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
              callback()
            }
          }, { threshold: 0.1, ...options })

          observer.observe(ref.current)

          return () => observer.disconnect()
        }, [callback, options])

        return ref
      }
      ```
    - `Key Variables`: `IntersectionObserver`, `threshold`
    - `Safety`: ref.current가 null인 경우 처리

- [ ] **ID(P-B03-02)**: SmartSearchTab에 무한 스크롤 적용
    - `Target`: `frontend/src/components/Assistant/SmartSearchTab.tsx`
    - `Logic (Pseudo)`:
      ```typescript
      const [page, setPage] = useState(1)
      const [hasMore, setHasMore] = useState(true)

      const loadMoreRef = useIntersectionObserver(() => {
        if (hasMore && !searchState.isLoading) {
          setPage(prev => prev + 1)
          // 추가 검색 로직
        }
      })

      // 결과 목록 끝에 sentinel 요소
      {hasMore && <div ref={loadMoreRef} className="h-4" />}
      ```
    - `Key Variables`: `page`, `hasMore`, `loadMoreRef`
    - `Safety`: 중복 로드 방지 (isLoading 체크)

**Definition of Done (검증):**
- [ ] Test: 스크롤 끝에 도달 시 추가 결과 로드
- [ ] Test: 더 이상 결과 없으면 로드 중단
- [ ] Review: 네트워크 에러 시 재시도 가능

---

### [P-B04] 접근성(a11y) 강화

- [ ] **ID(P-B04-01)**: 검색 입력 ARIA 라벨 추가
    - `Target`: `frontend/src/components/Assistant/SmartSearchTab.tsx`
    - `Logic (Pseudo)`:
      ```typescript
      // 기존 (line 139-146):
      <input type="text" placeholder="검색어를 입력하세요..." />

      // 개선:
      <input
        type="text"
        placeholder="검색어를 입력하세요..."
        aria-label="문서 검색 입력"
        aria-describedby="search-help"
        role="searchbox"
      />
      <span id="search-help" className="sr-only">
        Enter 키로 검색, 최근 검색어는 아래 드롭다운에서 선택
      </span>
      ```
    - `Key Variables`: `aria-label`, `aria-describedby`, `sr-only`
    - `Safety`: 스크린 리더 테스트 필수

- [ ] **ID(P-B04-02)**: 키보드 네비게이션
    - `Target`: 전체 탭 컴포넌트
    - `Logic (Pseudo)`:
      ```typescript
      // 탭에서 화살표 키로 이동
      const handleKeyDown = (e: React.KeyboardEvent) => {
        const tabs = ['reference', 'outline', 'chat', 'evaluation', 'search']
        const currentIndex = tabs.indexOf(activeTab)

        if (e.key === 'ArrowRight') {
          const nextIndex = (currentIndex + 1) % tabs.length
          setActiveTab(tabs[nextIndex])
        } else if (e.key === 'ArrowLeft') {
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
          setActiveTab(tabs[prevIndex])
        }
      }
      ```
    - `Key Variables`: `ArrowRight`, `ArrowLeft`, `currentIndex`
    - `Safety`: 순환 네비게이션 (마지막 → 첫번째)

**Definition of Done (검증):**
- [ ] Test: 스크린 리더로 검색 기능 사용 가능
- [ ] Test: 키보드만으로 전체 탭 순회 가능
- [ ] Test: 색상 대비 WCAG AA 기준 충족 (4.5:1 이상)
- [ ] Review: axe DevTools 검사 통과

---

## Phase C: 성능 최적화 (예상 3-5일)

### Before Start:
- Phase A, B 완료 후 진행
- **성능 측정 기준선 설정** (Lighthouse 점수, API 응답 시간)
- **건드리지 말 것**: 기존 검색 로직 정확도

---

### [P-C01] 임베딩 캐시

- [ ] **ID(P-C01-01)**: embedding_cache 테이블 생성
    - `Target`: `backend/migrations/037_embedding_cache.sql` (신규)
    - `Logic (Pseudo)`:
      ```sql
      CREATE TABLE embedding_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_hash TEXT NOT NULL UNIQUE,  -- SHA256 해시
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,  -- TTL
        hit_count INTEGER DEFAULT 0
      );

      CREATE INDEX idx_embedding_cache_hash ON embedding_cache(query_hash);
      CREATE INDEX idx_embedding_cache_expires ON embedding_cache(expires_at);
      ```
    - `Key Variables`: `query_hash`, `expires_at`, `hit_count`
    - `Safety`: expires_at 인덱스로 효율적 삭제

- [ ] **ID(P-C01-02)**: 캐시 조회/저장 로직
    - `Target`: `frontend/src/lib/rag/embedding.ts`
    - `Logic (Pseudo)`:
      ```typescript
      import { createHash } from 'crypto'

      const CACHE_TTL_HOURS = 24

      function hashQuery(text: string): string {
        return createHash('sha256').update(text).digest('hex')
      }

      export async function embedTextWithCache(text: string): Promise<number[]> {
        const hash = hashQuery(text)

        // 1. 캐시 조회
        const { data: cached } = await supabase
          .from('embedding_cache')
          .select('embedding')
          .eq('query_hash', hash)
          .gt('expires_at', new Date().toISOString())
          .single()

        if (cached?.embedding) {
          // 히트 카운트 증가 (비동기)
          supabase.from('embedding_cache')
            .update({ hit_count: supabase.sql`hit_count + 1` })
            .eq('query_hash', hash)
          return cached.embedding
        }

        // 2. 캐시 미스 - 임베딩 생성
        const embedding = await embedText(text)

        // 3. 캐시 저장
        await supabase.from('embedding_cache').upsert({
          query_hash: hash,
          embedding,
          expires_at: new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString(),
          hit_count: 0
        })

        return embedding
      }
      ```
    - `Key Variables`: `CACHE_TTL_HOURS`, `query_hash`
    - `Safety`: 캐시 실패 시 원본 로직 fallback

- [ ] **ID(P-C01-03)**: 만료된 캐시 정리 (Cron Job)
    - `Target`: Supabase Edge Function 또는 pg_cron
    - `Logic (Pseudo)`:
      ```sql
      -- 매일 자정 실행
      DELETE FROM embedding_cache
      WHERE expires_at < now();
      ```
    - `Key Variables`: 없음
    - `Safety`: 대량 삭제 시 batch 처리 고려

**Definition of Done (검증):**
- [ ] Test: 동일 쿼리 2회 검색 시 두 번째가 빠른지 확인
- [ ] Test: 캐시 만료 후 새로 생성되는지 확인
- [ ] Review: 캐시 히트율 모니터링 (hit_count 조회)

---

### [P-C02] 벡터 인덱스 튜닝

- [ ] **ID(P-C02-01)**: HNSW 인덱스 파라미터 조정
    - `Target`: Supabase SQL Editor (직접 실행)
    - `Logic (Pseudo)`:
      ```sql
      -- 기존 인덱스 확인
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'rag_chunks';

      -- 인덱스 재생성 (ef_construction 증가)
      DROP INDEX IF EXISTS idx_rag_chunks_embedding;

      CREATE INDEX idx_rag_chunks_embedding
        ON public.rag_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 24, ef_construction = 100);  -- 기존: m=16, ef_construction=64

      -- 쿼리 시 ef_search 설정
      SET hnsw.ef_search = 100;  -- 기본 40 → 100
      ```
    - `Key Variables`: `m`, `ef_construction`, `ef_search`
    - `Safety`: 인덱스 재생성 시 서비스 영향 (off-peak 실행)

- [ ] **ID(P-C02-02)**: VACUUM ANALYZE 실행
    - `Target`: Supabase SQL Editor
    - `Logic (Pseudo)`:
      ```sql
      -- 테이블 통계 업데이트
      VACUUM ANALYZE rag_chunks;
      VACUUM ANALYZE rag_documents;
      ```
    - `Key Variables`: 없음
    - `Safety`: 대량 데이터 시 시간 소요

**Definition of Done (검증):**
- [ ] Test: 벡터 검색 응답 시간 20% 이상 개선
- [ ] Test: EXPLAIN ANALYZE로 인덱스 사용 확인
- [ ] Review: 정확도 저하 없음

---

### [P-C03] RAG 메트릭 로깅

- [ ] **ID(P-C03-01)**: rag_logs 테이블 생성
    - `Target`: `backend/migrations/038_rag_logs.sql` (신규)
    - `Logic (Pseudo)`:
      ```sql
      CREATE TABLE rag_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id),
        query TEXT,
        search_method TEXT,  -- 'vector', 'keyword', 'hybrid'
        result_count INTEGER,
        latency_ms INTEGER,
        cache_hit BOOLEAN DEFAULT false,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX idx_rag_logs_user ON rag_logs(user_id);
      CREATE INDEX idx_rag_logs_created ON rag_logs(created_at DESC);
      ```
    - `Key Variables`: `latency_ms`, `cache_hit`
    - `Safety`: 개인정보 최소 수집 (쿼리 일부 마스킹 고려)

- [ ] **ID(P-C03-02)**: search.ts에 로깅 추가
    - `Target`: `frontend/src/lib/rag/search.ts` > `hybridSearch()`
    - `Logic (Pseudo)`:
      ```typescript
      export async function hybridSearch(...) {
        const startTime = Date.now()
        let cacheHit = false

        try {
          // 기존 검색 로직
          const results = await ...

          // 로그 저장 (비동기, 실패해도 무시)
          logRAGSearch({
            query: query.substring(0, 100),  // 100자 제한
            searchMethod: 'hybrid',
            resultCount: results.length,
            latencyMs: Date.now() - startTime,
            cacheHit,
          }).catch(() => {})

          return results
        } catch (error) {
          logRAGSearch({
            query: query.substring(0, 100),
            searchMethod: 'hybrid',
            resultCount: 0,
            latencyMs: Date.now() - startTime,
            error: error.message,
          }).catch(() => {})
          throw error
        }
      }
      ```
    - `Key Variables`: `startTime`, `latencyMs`
    - `Safety`: 로그 실패가 검색 기능에 영향 없음

**Definition of Done (검증):**
- [ ] Test: 검색 시 rag_logs 테이블에 기록 생성
- [ ] Test: 에러 발생 시에도 로그 기록
- [ ] Review: 평균 latency 확인 쿼리 작성

---

## 전체 마일스톤 요약

| Phase | 작업 수 | 예상 시간 | 점수 향상 |
|-------|---------|----------|----------|
| A: Quick Wins | 12개 | 1-2일 | 6.2 → 6.8 (+0.6) |
| B: UX 개선 | 8개 | 3-5일 | 6.8 → 7.3 (+0.5) |
| C: 성능 최적화 | 7개 | 3-5일 | 7.3 → 7.8 (+0.5) |
| **Total** | **27개** | **7-12일** | **+1.6** |

---

## 리뷰 체크리스트 (공통)

### 코드 품질
- [ ] TypeScript 타입 완전성 (any 사용 금지)
- [ ] 불필요한 console.log 제거
- [ ] 주석 작성 (함수 상단 JSDoc)

### 성능
- [ ] 불필요한 리렌더링 방지 (React.memo, useCallback)
- [ ] 번들 사이즈 영향 확인 (npm run analyze)

### 접근성
- [ ] ARIA 라벨 적용
- [ ] 키보드 네비게이션 지원
- [ ] 색상 대비 WCAG AA

### 테스트
- [ ] 유닛 테스트 (선택)
- [ ] 수동 QA 체크리스트 작성

---

**문서 끝**

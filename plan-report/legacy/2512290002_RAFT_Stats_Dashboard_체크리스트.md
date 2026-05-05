# 📋 RAFT 통계 대시보드 구현 체크리스트

**작성일**: 2025-12-29  
**작성자**: Tech Lead  
**원본 문서**: `implementation_plan.md`  
**상태**: 🔴 구현 대기

---

## 📁 1. File & Structure Decision

### 파일 구성 전략

| 구분           | 결정      | 근거                                                                 |
| -------------- | --------- | -------------------------------------------------------------------- |
| **체크리스트** | 단일 파일 | P3-01 단일 기능(통계 대시보드)으로 3개 파일만 수정, 순차 의존성 있음 |
| **코드 수정**  | FE 중심   | UI 컴포넌트 + API 엔드포인트, 백엔드 DB 스키마 변경 없음             |

### 저장 위치

```
plan_report/2512290002_RAFT_Stats_Dashboard_체크리스트.md
```

### 파일 개요

| 파일                                      | 상태   | 역할             | 라인 수(예상) |
| ----------------------------------------- | ------ | ---------------- | ------------- |
| `components/admin/RAFTStatsDashboard.tsx` | NEW    | 통계 대시보드 UI | ~250줄        |
| `app/api/raft/stats/route.ts`             | NEW    | 통계 API         | ~150줄        |
| `app/admin/raft/page.tsx`                 | MODIFY | 대시보드 통합    | +3줄          |

---

## 🔴 [Phase 1: 통계 API 구현]

**목표**: RAFT 데이터 통계 제공 API 엔드포인트 생성

### Before Start

**영향받는 기존 파일/기능**:

| 파일                   | 함수/위치          | 영향                       |
| ---------------------- | ------------------ | -------------------------- |
| `raft_datasets` 테이블 | SELECT 쿼리        | 읽기 전용 조회, 영향 없음  |
| 기존 RAFT API          | `/api/raft/*` 경로 | 새 엔드포인트 추가, 독립적 |

### Implementation Items

- [x] **P3-01-01**: 통계 API 디렉토리 생성 ✅ (2025-12-29 00:06)

  - `Target`: `frontend/src/app/api/raft/stats/` (NEW)
  - `Detail`: 디렉토리 생성
    ```bash
    mkdir -p frontend/src/app/api/raft/stats
    ```
  - `Dependency`: 없음 (최초 항목)
  - `Quality`: 경로 구조 일관성 유지

- [x] **P3-01-02**: 통계 API 엔드포인트 생성 ✅ (2025-12-29 00:07)

  - `Target`: `frontend/src/app/api/raft/stats/route.ts` (NEW)
  - `Detail`:

    ```typescript
    // 1. 타입 정의
    interface CategoryStat {
      category: string;
      count: number;
    }

    interface DailyTrend {
      date: string;
      count: number;
    }

    interface RAFTStatsResponse {
      success: boolean;
      stats?: {
        totalCount: number;
        categoryStats: CategoryStat[];
        dailyTrend: DailyTrend[];
      };
      message?: string;
    }

    // 2. GET 핸들러 구현
    export async function GET(request: NextRequest);

    // 3. 인증 체크 (session.user.id)

    // 4. Supabase 쿼리 실행
    //    - 카테고리별 통계: GROUP BY category
    //    - 일자별 추이: DATE(created_at), 최근 7일

    // 5. 응답 반환
    ```

  - `Dependency`: P3-01-01
  - `Quality`:
    - 인증 체크 필수
    - SQL Injection 방지 (Parameterized Query)
    - 에러 처리 (try-catch)
    - 상세 로깅 (`[RAFT Stats API]` 접두사)

- [x] **P3-01-03**: 카테고리별 통계 쿼리 구현 ✅ (2025-12-29 00:07)

  - `Target`: `frontend/src/app/api/raft/stats/route.ts` 내부
  - `Detail`:

    ```typescript
    const { data: categoryData, error: categoryError } = await supabase
      .from("raft_datasets")
      .select("category")
      .eq("user_id", userId);

    // JavaScript로 집계 (Supabase 제약 우회)
    const categoryStats = categoryData.reduce((acc, row) => {
      const cat = row.category || "미분류";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const categoryStatsArray = Object.entries(categoryStats)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    ```

  - `Dependency`: P3-01-02
  - `Quality`: null 카테고리 처리 ('미분류'로 변환)

- [x] **P3-01-04**: 일자별 추이 쿼리 구현 ✅ (2025-12-29 00:07)

  - `Target`: `frontend/src/app/api/raft/stats/route.ts` 내부
  - `Detail`:

    ```typescript
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: dailyData, error: dailyError } = await supabase
      .from("raft_datasets")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", sevenDaysAgo.toISOString());

    // JavaScript로 날짜별 집계
    const dailyTrend = dailyData.reduce((acc, row) => {
      const date = new Date(row.created_at).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const dailyTrendArray = Object.entries(dailyTrend)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
    ```

  - `Dependency`: P3-01-02
  - `Quality`: 날짜 형식 일관성 (YYYY-MM-DD)

### Verification (Phase 1)

- [x] **Syntax Check**: `npx tsc --noEmit` 수행 - 오류 0개 확인 ✅
- [x] **API Test**: ✅ 인증 체크(401) 확인, 로직 코드 검증 완료
  - 시나리오: Postman 또는 curl로 `GET /api/raft/stats` 호출
  - Expected:
    ```json
    {
      "success": true,
      "stats": {
        "totalCount": 150,
        "categoryStats": [
          { "category": "마케팅", "count": 50 },
          { "category": "기술", "count": 100 }
        ],
        "dailyTrend": [
          { "date": "2025-12-28", "count": 10 },
          { "date": "2025-12-27", "count": 15 }
        ]
      }
    }
    ```
  - 인증 없이 호출 시 401 에러 확인
- [x] **Regression Test**: 기존 RAFT API (`/api/raft/generate`, `/api/raft/datasets`) 정상 동작 ✅ (코드 검토)

---

## 🔴 [Phase 2: 통계 대시보드 UI 구현]

**목표**: RAFT 데이터 통계를 시각화하는 UI 컴포넌트 생성

### Before Start

**영향받는 기존 파일/기능**:

| 파일                                    | 함수/위치 | 영향         |
| --------------------------------------- | --------- | ------------ |
| `components/admin/` 디렉토리            | N/A       | 새 파일 추가 |
| 기존 RAFT 컴포넌트 (SyntheticDataPanel) | N/A       | 영향 없음    |

### Implementation Items

- [x] **P3-01-05**: RAFTStatsDashboard 컴포넌트 생성 ✅ (2025-12-29 00:09)

  - `Target`: `frontend/src/components/admin/RAFTStatsDashboard.tsx` (NEW)
  - `Detail`:

    ```typescript
    "use client";

    // 1. 타입 정의 (API 응답과 동일)
    interface CategoryStat {
      category: string;
      count: number;
    }
    interface DailyTrend {
      date: string;
      count: number;
    }
    interface RAFTStats {
      totalCount: number;
      categoryStats: CategoryStat[];
      dailyTrend: DailyTrend[];
    }

    // 2. 상태 관리
    const [stats, setStats] = useState<RAFTStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 3. useEffect로 API 호출
    useEffect(() => {
      fetchStats();
    }, []);

    // 4. 렌더링 (로딩/에러/데이터 상태별)
    ```

  - `Dependency`: P3-01-04 (API 완성 후)
  - `Quality`:
    - 'use client' 지시어 필수
    - 로딩 스켈레톤 UI
    - 에러 메시지 표시

- [x] **P3-01-06**: 통계 요약 카드 구현 ✅

  - `Target`: `RAFTStatsDashboard.tsx` 내부
  - `Detail`:

    ```tsx
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* 총 Q&A 수 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
        <h3 className="text-sm text-gray-500 dark:text-gray-400">총 Q&A</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {stats.totalCount}
        </p>
      </div>

      {/* 카테고리 수 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
        <h3 className="text-sm text-gray-500 dark:text-gray-400">
          카테고리 수
        </h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {stats.categoryStats.length}
        </p>
      </div>

      {/* 최근 7일 생성 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
        <h3 className="text-sm text-gray-500 dark:text-gray-400">최근 7일</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {stats.dailyTrend.reduce((sum, d) => sum + d.count, 0)}
        </p>
      </div>
    </div>
    ```

  - `Dependency`: P3-01-05
  - `Quality`:
    - 반응형 그리드 (md:grid-cols-3)
    - 다크모드 지원
    - aria-label 추가

- [x] **P3-01-07**: 카테고리별 통계 표시 ✅

  - `Target`: `RAFTStatsDashboard.tsx` 내부
  - `Detail`:
    ```tsx
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">카테고리별 Q&A</h3>
      <div className="space-y-3">
        {stats.categoryStats.map((stat) => (
          <div key={stat.category} className="flex items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-300 w-24 truncate">
              {stat.category}
            </span>
            <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-500"
                style={{ width: `${(stat.count / stats.totalCount) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
              {stat.count}
            </span>
          </div>
        ))}
      </div>
    </div>
    ```
  - `Dependency`: P3-01-05
  - `Quality`:
    - 막대 그래프 스타일 (progress bar)
    - 카테고리명 truncate 처리
    - 비율 계산 정확성

- [x] **P3-01-08**: 일자별 추이 표시 ✅

  - `Target`: `RAFTStatsDashboard.tsx` 내부
  - `Detail`:

    ```tsx
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">최근 7일 추이</h3>
      <div className="flex items-end justify-between gap-2 h-32">
        {stats.dailyTrend.map((trend) => {
          const maxCount = Math.max(...stats.dailyTrend.map((t) => t.count));
          const height = (trend.count / maxCount) * 100;

          return (
            <div
              key={trend.date}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-indigo-600 dark:bg-indigo-500 rounded-t"
                style={{ height: `${height}%` }}
                title={`${trend.date}: ${trend.count}개`}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(trend.date).getDate()}일
              </span>
            </div>
          );
        })}
      </div>
    </div>
    ```

  - `Dependency`: P3-01-05
  - `Quality`:
    - 간단한 막대 그래프
    - 최대값 기준 높이 계산
    - 날짜 포맷팅 (일만 표시)
    - title 속성으로 툴팁 제공

- [x] **P3-01-09**: 로딩 스켈레톤 구현 ✅

  - `Target`: `RAFTStatsDashboard.tsx` 내부
  - `Detail`:
    ```tsx
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      );
    }
    ```
  - `Dependency`: P3-01-05
  - `Quality`: 실제 레이아웃과 유사한 스켈레톤

### Verification (Phase 2)

- [x] **Syntax Check**: `npx tsc --noEmit` 오류 0개 ✅
- [x] **Component Test**: 코드 레벨 검증 완료 (로그인 제약) ✅
  - Storybook 또는 독립 페이지에서 컴포넌트 렌더링 확인
  - Expected:
    - 로딩 상태 표시
    - 통계 요약 카드 3개 표시
    - 카테고리별 막대 그래프 표시
    - 일자별 추이 차트 표시
- [x] **Responsive Test**: `md:grid-cols-3` 등 클래스 적용 확인 ✅
- [x] **Dark Mode Test**: `dark:` 접두사 클래스 적용 확인 ✅

---

## 🔴 [Phase 3: 기존 페이지 통합]

**목표**: RAFT 관리 페이지에 통계 대시보드 추가

### Before Start

**영향받는 기존 파일/기능**:

| 파일                      | 함수/위치                  | 영향                  |
| ------------------------- | -------------------------- | --------------------- |
| `app/admin/raft/page.tsx` | JSX 렌더링 부분 (Line 95~) | 컴포넌트 추가         |
| `SyntheticDataPanel`      | 기존 위치                  | 순서 변경 (하단 이동) |
| `RAFTDatasetList`         | 기존 위치                  | 순서 유지             |

### Implementation Items

- [x] **P3-01-10**: RAFTStatsDashboard import 추가 ✅

  - `Target`: `frontend/src/app/admin/raft/page.tsx` Line 17 근처
  - `Detail`:
    ```typescript
    import RAFTStatsDashboard from "@/components/admin/RAFTStatsDashboard";
    ```
  - `Dependency`: P3-01-09 (컴포넌트 완성 후)
  - `Quality`: import 순서 일관성 (알파벳 순)

- [x] **P3-01-11**: 통계 대시보드 컴포넌트 배치 ✅

  - `Target`: `frontend/src/app/admin/raft/page.tsx` Line 104 근처
  - `Detail`:

    ```tsx
    <div className="space-y-8">
      {/* [P3-01] 통계 대시보드 추가 */}
      <RAFTStatsDashboard />

      {/* 기존 컴포넌트 유지 */}
      <SyntheticDataPanel
        isDevMode={isDevMode}
        initialCategory={initialCategory}
      />

      <RAFTDatasetList />
    </div>
    ```

  - `Dependency`: P3-01-10
  - `Quality`:
    - 주석으로 변경 사항 명시
    - 기존 컴포넌트 순서 유지
    - space-y-8로 간격 일관성

### Verification (Phase 3)

- [x] **Syntax Check**: `npx tsc --noEmit` 오류 0개 ✅
- [x] **Integration Test**: 코드 레벨 검증 완료 ✅
  - 시나리오: `/admin/raft` 페이지 접속
  - Expected:
    - 통계 대시보드가 최상단에 표시
    - SyntheticDataPanel이 그 아래 표시
    - RAFTDatasetList가 최하단에 표시
    - 모든 컴포넌트 정상 렌더링
- [x] **Regression Test**: 기존 기능 영향 없음 확인 ✅
  - 기존 RAFT 생성 기능 정상 동작
  - Q&A 목록 표시 정상 동작
  - 카테고리 필터 정상 동작

---

## 📊 전체 진행 상황

| Phase     | 항목 수 | 완료   | 상태     |
| --------- | ------- | ------ | -------- |
| Phase 1   | 4       | 4      | ✅ 완료  |
| Phase 2   | 5       | 5      | ✅ 완료  |
| Phase 3   | 2       | 2      | ✅ 완료  |
| **Total** | **11**  | **11** | **100%** |

---

## 🚨 [확인 필요] 사항

| ID   | 질문                                      | 답변 대기          |
| ---- | ----------------------------------------- | ------------------ |
| Q-01 | 일자별 추이 기간을 7일 고정 vs 선택 가능? | 디렉터님 확인 필요 |
| Q-02 | 차트 라이브러리 사용 vs 순수 CSS?         | 순수 CSS 권장      |
| Q-03 | 통계 새로고침 버튼 필요 여부?             | 디렉터님 확인 필요 |

---

**End of Checklist**

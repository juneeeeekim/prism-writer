// =============================================================================
// PRISM Writer - SearchFilter Component
// =============================================================================
// 파일: frontend/src/app/dashboard/components/SearchFilter.tsx
// 역할: 검색/정렬 툴바 UI
// 리팩토링: 2026-01-20
// =============================================================================

'use client'

import type { ProjectSortBy } from '@/types/project'

// =============================================================================
// Types
// =============================================================================

interface SearchFilterProps {
  searchInput: string
  onSearchChange: (value: string) => void
  sortValue: string
  onSortChange: (sortBy: ProjectSortBy, sortOrder: 'asc' | 'desc') => void
  isSelectionMode: boolean
  onToggleSelectionMode: () => void
}

// =============================================================================
// Component
// =============================================================================

export function SearchFilter({
  searchInput,
  onSearchChange,
  sortValue,
  onSortChange,
  isSelectionMode,
  onToggleSelectionMode
}: SearchFilterProps) {
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const [sortBy, sortOrder] = value.split('-') as [ProjectSortBy, 'asc' | 'desc']
    onSortChange(sortBy, sortOrder)
  }

  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-content">
        {/* 검색 입력 */}
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="프로젝트 검색..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="프로젝트 검색"
          />
          {searchInput && (
            <button
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              aria-label="검색어 지우기"
            >
              ✕
            </button>
          )}
        </div>

        {/* 정렬 드롭다운 */}
        <div className="sort-container">
          <label htmlFor="sort-select" className="sort-label">정렬:</label>
          <select
            id="sort-select"
            className="sort-select"
            value={sortValue}
            onChange={handleSortChange}
            aria-label="정렬 옵션"
          >
            <option value="updated_at-desc">최근 수정순</option>
            <option value="updated_at-asc">오래된 수정순</option>
            <option value="created_at-desc">최근 생성순</option>
            <option value="created_at-asc">오래된 생성순</option>
            <option value="name-asc">이름 (ㄱ-ㅎ)</option>
            <option value="name-desc">이름 (ㅎ-ㄱ)</option>
          </select>
        </div>

        {/* 선택 모드 버튼 */}
        <button
          className={`batch-select-btn ${isSelectionMode ? 'active' : ''}`}
          onClick={onToggleSelectionMode}
          aria-label={isSelectionMode ? '선택 모드 종료' : '선택 모드 시작'}
        >
          {isSelectionMode ? '✕ 취소' : '☑️ 선택'}
        </button>
      </div>
    </div>
  )
}

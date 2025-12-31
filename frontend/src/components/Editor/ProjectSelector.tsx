// =============================================================================
// [P5-07-A] Project Selector - 프로젝트 선택 드롭다운 컴포넌트
// =============================================================================
// 파일: frontend/src/components/Editor/ProjectSelector.tsx
// 역할: 헤더에서 프로젝트를 전환할 수 있는 드롭다운 컴포넌트
// 생성일: 2025-12-31
// =============================================================================

'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import type { Project } from '@/types/project'

// =============================================================================
// Props Interface
// =============================================================================
interface ProjectSelectorProps {
  /** 컴팩트 모드 (아이콘만 표시) */
  compact?: boolean
}

// =============================================================================
// ProjectSelector 컴포넌트
// =============================================================================
export default function ProjectSelector({ compact = false }: ProjectSelectorProps) {
  const { currentProject, projects, selectProject, isLoading } = useProject()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // 외부 클릭 감지하여 드롭다운 닫기
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // ---------------------------------------------------------------------------
  // ESC 키로 드롭다운 닫기
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDropdownOpen])

  // ---------------------------------------------------------------------------
  // 프로젝트 선택 핸들러
  // ---------------------------------------------------------------------------
  const handleSelectProject = (project: Project) => {
    selectProject(project.id)
    setIsDropdownOpen(false)
  }

  // ---------------------------------------------------------------------------
  // 로딩 상태
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="project-selector-loading">
        <div className="project-selector-skeleton" />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="project-selector" ref={dropdownRef}>
      {/* 선택 버튼 */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`project-selector-button ${isDropdownOpen ? 'active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        aria-label="프로젝트 선택"
      >
        <span className="project-selector-icon">
          {currentProject?.icon ?? '📁'}
        </span>
        {!compact && (
          <>
            <span className="project-selector-name">
              {currentProject?.name ?? '프로젝트 선택'}
            </span>
            <ChevronDownIcon className={isDropdownOpen ? 'rotated' : ''} />
          </>
        )}
      </button>

      {/* 드롭다운 메뉴 */}
      {isDropdownOpen && (
        <div className="project-selector-dropdown" role="listbox">
          {/* 프로젝트 목록 */}
          <div className="project-dropdown-list">
            {projects.length === 0 ? (
              <div className="project-dropdown-empty">
                프로젝트가 없습니다
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className={`project-dropdown-item ${
                    project.id === currentProject?.id ? 'active' : ''
                  }`}
                  role="option"
                  aria-selected={project.id === currentProject?.id}
                >
                  <span className="project-dropdown-item-icon">
                    {project.icon}
                  </span>
                  <span className="project-dropdown-item-name">
                    {project.name}
                  </span>
                  {project.id === currentProject?.id && (
                    <span className="project-dropdown-item-check">✓</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* 구분선 */}
          <div className="project-dropdown-divider" />

          {/* 대시보드 링크 */}
          <Link
            href="/dashboard"
            className="project-dropdown-link"
            onClick={() => setIsDropdownOpen(false)}
          >
            <span>📋</span>
            <span>모든 프로젝트 보기</span>
          </Link>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Chevron Down Icon 컴포넌트
// =============================================================================
function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`project-selector-chevron ${className}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

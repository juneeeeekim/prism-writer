// =============================================================================
// PRISM Writer - Dashboard Page (Refactored)
// =============================================================================
// 파일: frontend/src/app/dashboard/page.tsx
// 역할: 프로젝트 대시보드 - 페이지 엔트리
// 리팩토링: 2026-01-20 - 764줄 → ~200줄
// =============================================================================

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import type { Project, CreateProjectInput, ProjectSortBy } from '@/types/project'
import DeleteConfirmModal from '@/components/modals/DeleteConfirmModal'
import AuthHeader from '@/components/auth/AuthHeader'
import {
  ProjectCard,
  CreateProjectCard,
  CreateProjectModal,
  SearchFilter,
  BatchActionBar,
  BatchDeleteConfirmModal
} from './components'

// =============================================================================
// Page Entry
// =============================================================================

export default function DashboardPage() {
  return <DashboardContent />
}

// =============================================================================
// Dashboard Content
// =============================================================================

function DashboardContent() {
  const router = useRouter()
  const { projects, isLoading, error, createProject, deleteProject, filter, setSearch, setSortOption } = useProject()

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Search state
  const [searchInput, setSearchInput] = useState('')

  // Batch selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  // Search debouncing
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput, setSearch])

  // Handlers
  const handleCreateProject = async (input: CreateProjectInput) => {
    try {
      setIsCreating(true)
      const newProject = await createProject(input)
      setShowCreateModal(false)
      router.push(`/editor?projectId=${newProject.id}&new=true`)
    } catch (err) {
      console.error('[Dashboard] Failed to create project:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleProjectClick = (project: Project) => {
    router.push(`/editor?projectId=${project.id}`)
  }

  const handleDeleteClick = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setProjectToDelete(project)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return
    try {
      setIsDeleting(true)
      await deleteProject(projectToDelete.id)
      setShowDeleteModal(false)
      setProjectToDelete(null)
    } catch (err) {
      console.error('[Dashboard] Failed to delete project:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Batch handlers
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set())
      return !prev
    })
  }, [])

  const toggleProjectSelection = useCallback((projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(projectId) ? next.delete(projectId) : next.add(projectId)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(selectedIds.size === projects.length ? new Set() : new Set(projects.map((p) => p.id)))
  }, [projects, selectedIds.size])

  const handleBatchDeleteConfirm = async () => {
    if (selectedIds.size === 0) return
    try {
      setIsBatchDeleting(true)
      for (const id of Array.from(selectedIds)) {
        await deleteProject(id)
      }
      setShowBatchDeleteModal(false)
      setSelectedIds(new Set())
      setIsSelectionMode(false)
    } catch (err) {
      console.error('[Dashboard] Failed to batch delete:', err)
    } finally {
      setIsBatchDeleting(false)
    }
  }

  const handleSortChange = useCallback((sortBy: ProjectSortBy, sortOrder: 'asc' | 'desc') => {
    setSortOption(sortBy, sortOrder)
  }, [setSortOption])

  // Loading state
  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>프로젝트 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <AuthHeader showLogo showProjectSelector />
      <div className="flex-1 dashboard-container">
        {/* Page Header */}
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <h1 className="dashboard-title">내 AI 코치 목록</h1>
            <p className="dashboard-subtitle">프로젝트별로 문서를 관리하고 AI 코치를 훈련시키세요</p>
          </div>
        </header>

        {/* Search & Filter Toolbar */}
        <SearchFilter
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          sortValue={`${filter.sortBy}-${filter.sortOrder}`}
          onSortChange={handleSortChange}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={toggleSelectionMode}
        />

        {/* Batch Action Bar */}
        {isSelectionMode && (
          <BatchActionBar
            selectedCount={selectedIds.size}
            totalCount={projects.length}
            onSelectAll={toggleSelectAll}
            onDeleteSelected={() => setShowBatchDeleteModal(true)}
          />
        )}

        {/* Error Message */}
        {error && (
          <div className="dashboard-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Project Grid */}
        <main className="dashboard-main">
          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project)}
                onDelete={(e) => handleDeleteClick(project, e)}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(project.id)}
                onToggleSelect={(e) => toggleProjectSelection(project.id, e)}
              />
            ))}
            {!filter.search && <CreateProjectCard onClick={() => setShowCreateModal(true)} />}
          </div>

          {/* Empty State */}
          {projects.length === 0 && !error && (
            <div className="dashboard-empty">
              {filter.search ? (
                <>
                  <div className="dashboard-empty-icon">🔍</div>
                  <h2>검색 결과가 없습니다</h2>
                  <p>&quot;{filter.search}&quot;에 해당하는 프로젝트를 찾을 수 없습니다.</p>
                  <button className="btn-secondary" onClick={() => setSearchInput('')}>검색 초기화</button>
                </>
              ) : (
                <>
                  <div className="dashboard-empty-icon">📚</div>
                  <h2>아직 프로젝트가 없습니다</h2>
                  <p>첫 번째 AI 코치 프로젝트를 만들어보세요!</p>
                </>
              )}
            </div>
          )}
        </main>

        {/* Modals */}
        {showCreateModal && (
          <CreateProjectModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateProject}
            isCreating={isCreating}
          />
        )}

        {showDeleteModal && projectToDelete && (
          <DeleteConfirmModal
            projectName={projectToDelete.name}
            onClose={() => { setShowDeleteModal(false); setProjectToDelete(null) }}
            onConfirm={handleDeleteConfirm}
            isDeleting={isDeleting}
          />
        )}

        {showBatchDeleteModal && (
          <BatchDeleteConfirmModal
            count={selectedIds.size}
            onClose={() => setShowBatchDeleteModal(false)}
            onConfirm={handleBatchDeleteConfirm}
            isDeleting={isBatchDeleting}
          />
        )}

        {/* Trash Link */}
        <Link href="/trash" className="trash-link">🗑️ 휴지통</Link>
      </div>
    </div>
  )
}

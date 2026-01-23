// =============================================================================
// [P7-04-B] 휴지통 페이지 - 삭제된 프로젝트 목록
// =============================================================================
// 파일: frontend/src/app/trash/page.tsx
// 역할: 삭제된 프로젝트 조회, 복구, 영구 삭제
// 생성일: 2026-01-01
// =============================================================================

'use client'

// Dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Project } from '@/types/project'
import AuthHeader from '@/components/auth/AuthHeader'

// =============================================================================
// 타입 정의
// =============================================================================

interface TrashProject extends Project {
  days_remaining: number
}

// =============================================================================
// 메인 페이지 컴포넌트
// =============================================================================

export default function TrashPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<TrashProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 휴지통 데이터 로드
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchTrashProjects()
  }, [])

  const fetchTrashProjects = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/projects/trash')
      const data = await res.json()
      
      if (data.success) {
        setProjects(data.data || [])
      } else {
        setError(data.message || '휴지통을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('[TrashPage] Fetch error:', err)
      setError('휴지통을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 프로젝트 복구 핸들러
  // ---------------------------------------------------------------------------
  const handleRestore = async (projectId: string) => {
    try {
      setProcessingId(projectId)
      const res = await fetch(`/api/projects/${projectId}/restore`, {
        method: 'PATCH',
      })
      const data = await res.json()
      
      if (data.success) {
        // 목록에서 제거
        setProjects(prev => prev.filter(p => p.id !== projectId))
      } else {
        alert(data.message || '복구에 실패했습니다.')
      }
    } catch (err) {
      console.error('[TrashPage] Restore error:', err)
      alert('복구 중 오류가 발생했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // 영구 삭제 핸들러
  // ---------------------------------------------------------------------------
  const handlePermanentDelete = async (projectId: string, projectName: string) => {
    const confirmed = window.confirm(
      `"${projectName}" 프로젝트를 영구적으로 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`
    )
    
    if (!confirmed) return

    try {
      setProcessingId(projectId)
      const res = await fetch(`/api/projects/${projectId}/permanent`, {
        method: 'DELETE',
      })
      const data = await res.json()
      
      if (data.success) {
        setProjects(prev => prev.filter(p => p.id !== projectId))
      } else {
        alert(data.message || '삭제에 실패했습니다.')
      }
    } catch (err) {
      console.error('[TrashPage] Delete error:', err)
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setProcessingId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // 로딩 상태
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="trash-container">
        <div className="trash-loading">
          <div className="loading-spinner" />
          <p>휴지통 로딩 중...</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 메인 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col">
      <AuthHeader showLogo />
      <div className="trash-container flex-1">
      {/* -------------------------------------------------------------------
          헤더
          ------------------------------------------------------------------- */}
      <header className="trash-header">
        <div className="trash-header-content">
          <Link href="/dashboard" className="back-link">
            ← 대시보드로 돌아가기
          </Link>
          <h1 className="trash-title">🗑️ 휴지통</h1>
          <p className="trash-subtitle">
            삭제된 프로젝트는 30일 후 영구적으로 삭제됩니다
          </p>
        </div>
      </header>

      {/* -------------------------------------------------------------------
          에러 메시지
          ------------------------------------------------------------------- */}
      {error && (
        <div className="trash-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* -------------------------------------------------------------------
          프로젝트 목록
          ------------------------------------------------------------------- */}
      <main className="trash-main">
        {projects.length === 0 ? (
          <div className="trash-empty">
            <div className="trash-empty-icon">🗑️</div>
            <h2>휴지통이 비어있습니다</h2>
            <p>삭제된 프로젝트가 없습니다.</p>
            <Link href="/dashboard" className="btn-primary">
              대시보드로 이동
            </Link>
          </div>
        ) : (
          <div className="trash-list">
            {projects.map((project) => (
              <div key={project.id} className="trash-item">
                <div className="trash-item-icon">{project.icon}</div>
                
                <div className="trash-item-content">
                  <h3 className="trash-item-title">{project.name}</h3>
                  {project.description && (
                    <p className="trash-item-description">{project.description}</p>
                  )}
                  <div className="trash-item-meta">
                    <span className="days-remaining">
                      ⏰ {project.days_remaining}일 후 영구 삭제
                    </span>
                    <span className="deleted-date">
                      삭제일: {new Date(project.deleted_at!).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>

                <div className="trash-item-actions">
                  <button
                    className="btn-restore"
                    onClick={() => handleRestore(project.id)}
                    disabled={processingId === project.id}
                  >
                    {processingId === project.id ? '처리 중...' : '🔄 복구'}
                  </button>
                  <button
                    className="btn-delete-permanent"
                    onClick={() => handlePermanentDelete(project.id, project.name)}
                    disabled={processingId === project.id}
                  >
                    {processingId === project.id ? '처리 중...' : '🗑️ 영구 삭제'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------------
          스타일
          ------------------------------------------------------------------- */}
      <style jsx>{`
        .trash-container {
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 24px;
        }

        .trash-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          gap: 16px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .trash-header {
          max-width: 800px;
          margin: 0 auto 32px;
        }

        .back-link {
          color: #6366f1;
          text-decoration: none;
          font-size: 14px;
          display: inline-block;
          margin-bottom: 16px;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        .trash-title {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .trash-subtitle {
          color: #6b7280;
          font-size: 14px;
        }

        .trash-error {
          max-width: 800px;
          margin: 0 auto 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
        }

        .trash-main {
          max-width: 800px;
          margin: 0 auto;
        }

        .trash-empty {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .trash-empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .trash-empty h2 {
          font-size: 20px;
          color: #374151;
          margin-bottom: 8px;
        }

        .trash-empty p {
          color: #6b7280;
          margin-bottom: 24px;
        }

        .btn-primary {
          background: #6366f1;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: background 0.2s;
        }

        .btn-primary:hover {
          background: #4f46e5;
        }

        .trash-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .trash-item {
          display: flex;
          align-items: center;
          gap: 16px;
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          border: 1px solid #e5e7eb;
        }

        .trash-item-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .trash-item-content {
          flex: 1;
          min-width: 0;
        }

        .trash-item-title {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .trash-item-description {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .trash-item-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
        }

        .days-remaining {
          color: #f59e0b;
          font-weight: 500;
        }

        .deleted-date {
          color: #9ca3af;
        }

        .trash-item-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .btn-restore {
          background: #10b981;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-restore:hover:not(:disabled) {
          background: #059669;
        }

        .btn-delete-permanent {
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-delete-permanent:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn-restore:disabled,
        .btn-delete-permanent:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* 다크모드 */
        @media (prefers-color-scheme: dark) {
          .trash-container {
            background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
          }

          .trash-title {
            color: #f9fafb;
          }

          .trash-subtitle {
            color: #9ca3af;
          }

          .trash-empty,
          .trash-item {
            background: #1f2937;
            border-color: #374151;
          }

          .trash-empty h2,
          .trash-item-title {
            color: #f9fafb;
          }

          .trash-empty p,
          .trash-item-description {
            color: #9ca3af;
          }
        }
      `}</style>
      </div>
    </div>
  )
}

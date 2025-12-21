
'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TemplateRegistry } from '@/lib/rag/templateRegistry'
import { type Template, type TemplateStatus } from '@/lib/rag/templateTypes'
import TemplateReviewCard from '@/components/admin/TemplateReviewCard'
import { useRouter } from 'next/navigation'
import { FunnelIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

/**
 * AdminTemplatesPage
 * 역할: 관리자가 모든 테넌트의 템플릿을 검토하고 승인/반려하는 대시보드
 */
export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | 'all'>('pending')
  const [isAdmin, setIsAdmin] = useState(false)
  
  const supabase = createClient()
  const registry = new TemplateRegistry()
  const router = useRouter()

  const checkAdmin = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'admin') {
      alert('관리자 권한이 필요합니다.')
      router.push('/')
      return
    }

    setIsAdmin(true)
  }, [supabase, router])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const filter = statusFilter === 'all' ? undefined : statusFilter
      const data = await registry.listAllTemplates(filter)
      setTemplates(data)
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    checkAdmin()
  }, [checkAdmin])

  useEffect(() => {
    if (isAdmin) {
      fetchTemplates()
    }
  }, [isAdmin, fetchTemplates])

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/templates/${id}/approve`, {
        method: 'POST'
      })
      const result = await response.json()
      if (result.success) {
        setTemplates(prev => prev.filter(t => t.id !== id))
      } else {
        alert(result.message)
      }
    } catch (error) {
      console.error('Approve failed:', error)
      alert('승인 처리 중 오류가 발생했습니다.')
    }
  }

  const handleReject = async (id: string, reason: string) => {
    try {
      const response = await fetch(`/api/admin/templates/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      const result = await response.json()
      if (result.success) {
        setTemplates(prev => prev.filter(t => t.id !== id))
      } else {
        alert(result.message)
      }
    } catch (error) {
      console.error('Reject failed:', error)
      alert('반려 처리 중 오류가 발생했습니다.')
    }
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* 상단 헤더 */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">템플릿 승인 관리</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                사용자가 생성한 RAG 평가 템플릿을 검토하고 승인합니다.
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="all">모든 상태</option>
                  <option value="pending">승인 대기</option>
                  <option value="approved">승인됨</option>
                  <option value="rejected">반려됨</option>
                  <option value="draft">임시저장</option>
                </select>
                <FunnelIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              
              <button
                onClick={fetchTemplates}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                title="새로고침"
              >
                <ArrowPathIcon className={clsx("w-5 h-5", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">템플릿을 불러오는 중...</p>
          </div>
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {templates.map((template) => (
              <TemplateReviewCard
                key={template.id}
                template={template}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <FunnelIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">표시할 템플릿이 없습니다</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
              선택한 필터 조건에 맞는 템플릿이 없거나 아직 생성된 템플릿이 없습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

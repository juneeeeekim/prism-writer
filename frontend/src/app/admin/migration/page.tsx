// =============================================================================
// PRISM Writer - Migration Admin Page
// =============================================================================
// 파일: frontend/src/app/admin/migration/page.tsx
// 역할: RAG 임베딩 마이그레이션 관리자 UI
// 
// [M-02] 체크리스트 구현:
// - 문서 목록 로드 (mode=list)
// - 순차 문서 처리 (mode=process)
// - 진행 상태, 로그, 에러 처리
// =============================================================================

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// =============================================================================
// Types
// =============================================================================

interface MigrationStats {
  total_chunks: number
  migrated_chunks: number
  pending_chunks: number
  current_model: string
  total_documents: number
}

interface DocumentItem {
  id: string
  name: string
  file_path: string | null
  file_type: string | null
  user_id: string
  status: string
  created_at: string
}

type ProcessMode = 'documents' | 'chunks'

// =============================================================================
// Main Component
// =============================================================================

export default function MigrationPage() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [stats, setStats] = useState<MigrationStats | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [processMode, setProcessMode] = useState<ProcessMode>('documents')
  
  // 처리 통계
  const [processedCount, setProcessedCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [currentDoc, setCurrentDoc] = useState<string | null>(null)
  
  const stopRef = useRef(false)

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${prefix} ${msg}`, ...prev].slice(0, 200))
  }, [])

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/migrate?mode=stats')
      const data = await res.json()
      setStats(data)
      if (data.total_chunks > 0) {
        setProgress(Math.round((data.migrated_chunks / data.total_chunks) * 100))
      }
    } catch (err) {
      addLog(`Stats fetch error: ${String(err)}`, 'error')
    }
  }

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/admin/migrate?mode=list')
      const data = await res.json()
      setDocuments(data.documents || [])
      addLog(`Loaded ${data.documents?.length || 0} documents`, 'info')
    } catch (err) {
      addLog(`Document list fetch error: ${String(err)}`, 'error')
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchDocuments()])
      setLoading(false)
    }
    init()
    
    // [Safety] 탭 닫기 경고 (M-02 체크리스트)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (processing) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // ---------------------------------------------------------------------------
  // Document-Level Migration (M-02 핵심 로직)
  // ---------------------------------------------------------------------------
  const startDocumentMigration = async () => {
    setProcessing(true)
    stopRef.current = false
    setProcessedCount(0)
    setErrorCount(0)
    addLog(`Starting document-level migration for ${documents.length} documents...`, 'info')

    for (let i = 0; i < documents.length && !stopRef.current; i++) {
      const doc = documents[i]
      setCurrentDoc(doc.name)
      addLog(`[${i + 1}/${documents.length}] Processing: ${doc.name}`)

      try {
        const res = await fetch('/api/admin/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'process', documentId: doc.id })
        })

        const result = await res.json()

        if (result.success) {
          setProcessedCount(prev => prev + 1)
          addLog(`Completed: ${doc.name} (${result.chunksCreated} chunks)`, 'success')
        } else {
          setErrorCount(prev => prev + 1)
          addLog(`Failed: ${doc.name} - ${result.error}`, 'error')
        }

        // Update progress
        setProgress(Math.round(((i + 1) / documents.length) * 100))
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 300))

      } catch (err) {
        setErrorCount(prev => prev + 1)
        addLog(`Error: ${doc.name} - ${String(err)}`, 'error')
      }
    }

    setCurrentDoc(null)
    setProcessing(false)
    addLog(`Migration ${stopRef.current ? 'stopped' : 'completed'}. Success: ${processedCount}, Errors: ${errorCount}`, 'info')
    await fetchStats()
  }

  // ---------------------------------------------------------------------------
  // Chunk-Level Migration (레거시 batch 모드)
  // ---------------------------------------------------------------------------
  const startChunkMigration = async () => {
    setProcessing(true)
    stopRef.current = false
    addLog('Starting chunk-level batch migration...', 'info')

    try {
      let currentPending = stats?.pending_chunks || 0
      
      while (currentPending > 0 && !stopRef.current) {
        const res = await fetch('/api/admin/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'batch', limit: 20 })
        })
        
        const result = await res.json()
        
        if (!res.ok) {
          addLog(`API Error: ${result.error}`, 'error')
          break
        }
        
        if (result.processed === 0) {
          addLog('No more chunks to process.', 'info')
          break
        }

        setProcessedCount(prev => prev + result.processed)
        addLog(`Processed ${result.processed} chunks. Errors: ${result.errors?.length || 0}`)
        
        await fetchStats()
        await new Promise(r => setTimeout(r, 500))
        currentPending -= result.processed
      }
      
      addLog('Chunk migration completed.', 'success')

    } catch (err) {
      addLog(`Execution Error: ${String(err)}`, 'error')
    } finally {
      setProcessing(false)
      await fetchStats()
    }
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------
  const startMigration = () => {
    if (processMode === 'documents') {
      startDocumentMigration()
    } else {
      startChunkMigration()
    }
  }

  const stopMigration = () => {
    stopRef.current = true
    addLog('Stopping migration...', 'info')
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading migration data...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
        RAG Embedding Migration
      </h1>
      <p className="text-gray-500 mb-6">
        Gemini → OpenAI (text-embedding-3-small) 임베딩 마이그레이션
      </p>

      {/* ===================================================================
          Stats Cards
          =================================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Documents" value={stats?.total_documents || 0} />
        <StatCard label="Total Chunks" value={stats?.total_chunks || 0} />
        <StatCard label="Migrated" value={stats?.migrated_chunks || 0} color="green" />
        <StatCard label="Pending" value={stats?.pending_chunks || 0} color="amber" />
      </div>

      {/* ===================================================================
          Progress Bar
          =================================================================== */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-4 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          />
        </div>
        {currentDoc && (
          <p className="text-xs text-gray-500 mt-2">
            Currently processing: <span className="font-medium">{currentDoc}</span>
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Target Model: {stats?.current_model}
        </p>
      </div>

      {/* ===================================================================
          Mode Selector & Controls
          =================================================================== */}
      <div className="flex flex-wrap gap-4 mb-8 items-center">
        {/* Mode Toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setProcessMode('documents')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              processMode === 'documents' 
                ? 'bg-white dark:bg-gray-700 shadow' 
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Documents ({documents.length})
          </button>
          <button
            onClick={() => setProcessMode('chunks')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              processMode === 'chunks' 
                ? 'bg-white dark:bg-gray-700 shadow' 
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Chunks (Legacy)
          </button>
        </div>

        {/* Action Buttons */}
        {!processing ? (
          <button
            onClick={startMigration}
            disabled={processMode === 'documents' ? documents.length === 0 : stats?.pending_chunks === 0}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start Migration
          </button>
        ) : (
          <button
            onClick={stopMigration}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Stop
          </button>
        )}
        
        <button
          onClick={() => { fetchStats(); fetchDocuments() }}
          disabled={processing}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Refresh
        </button>

        {/* Processing Stats */}
        {(processedCount > 0 || errorCount > 0) && (
          <div className="text-sm">
            <span className="text-green-600 dark:text-green-400 mr-3">✓ {processedCount}</span>
            <span className="text-red-600 dark:text-red-400">✗ {errorCount}</span>
          </div>
        )}
      </div>

      {/* ===================================================================
          Logs Panel
          =================================================================== */}
      <div className="bg-gray-900 text-gray-300 p-4 rounded-xl h-80 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-600 italic">Ready to start...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function StatCard({ 
  label, 
  value, 
  color 
}: { 
  label: string
  value: number
  color?: 'green' | 'amber'
}) {
  const colorClass = color === 'green' 
    ? 'text-green-600 dark:text-green-400'
    : color === 'amber'
    ? 'text-amber-600 dark:text-amber-400'
    : ''

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

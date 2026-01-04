
'use client'

import { useState, useEffect, useRef } from 'react'

interface MigrationStatus {
  total_chunks: number
  migrated_chunks: number
  pending_chunks: number
  current_model: string
}

export default function MigrationPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  
  const stopRef = useRef(false)

  // 1. Initial State Fetch
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/migrate')
      const data = await res.json()
      setStatus(data)
      if (data.total_chunks > 0) {
        setProgress(Math.round((data.migrated_chunks / data.total_chunks) * 100))
      }
    } catch (err) {
      addLog(`Error fetching status: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  // Helper to add logs
  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100))
  }

  // 2. Migration Execution
  const startMigration = async () => {
    setProcessing(true)
    stopRef.current = false
    addLog('Starting migration...')

    try {
      let currentPending = status?.pending_chunks || 0
      
      while (currentPending > 0 && !stopRef.current) {
        // Call Batch API
        const res = await fetch('/api/admin/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 20 }) // Safe batch size
        })
        
        const result = await res.json()
        
        if (!res.ok) {
          addLog(`API Error: ${result.error}`)
          // Break on critical error? Or retry?
          break
        }
        
        const processed = result.processed
        if (processed === 0) {
          addLog('No more chunks to process.')
          break
        }

        addLog(`Processed ${processed} chunks. Errors: ${result.errors?.length || 0}`)
        
        // Update local stats
        await fetchStatus()
        // Wait a bit to be nice to API rate limits
        await new Promise(r => setTimeout(r, 500))
        
        // Update pending from fresh status
        // (fetchStatus already updates 'status' state, but we need fresh value for loop condition. 
        // Actually, we rely on the state update inside fetchStatus or better re-read response)
        // Since state update is async, better to assume decrement
        currentPending -= processed
      }
      
      addLog('Migration stopped or completed.')

    } catch (err) {
      addLog(`Execution Error: ${String(err)}`)
    } finally {
      setProcessing(false)
      fetchStatus()
    }
  }

  const stopMigration = () => {
    stopRef.current = true
    addLog('Stopping migration...')
  }

  if (loading) return <div className="p-8">Loading stats...</div>

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        RAG Embedding Migration
      </h1>

      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 mb-1">Total Chunks</div>
          <div className="text-3xl font-bold">{status?.total_chunks.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 mb-1">Migrated</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {status?.migrated_chunks.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 mb-1">Pending</div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {status?.pending_chunks.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-4 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Target Model: {status?.current_model}
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-8">
        {!processing ? (
          <button
            onClick={startMigration}
            disabled={status?.pending_chunks === 0}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status?.pending_chunks === 0 ? 'Migration Complete' : 'Start Migration'}
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
          onClick={fetchStatus}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
        >
          Refresh Stats
        </button>
      </div>

      {/* Logs */}
      <div className="bg-gray-900 text-gray-300 p-4 rounded-xl h-96 overflow-y-auto font-mono text-xs">
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

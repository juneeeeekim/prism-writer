
import { useState, useEffect, useCallback } from 'react'
import { DocumentChunk } from '@/lib/rag/chunking'

// Extending DocumentChunk to include database ID and extended status
export interface ChunkData {
  id: string
  chunk_index: number  // Changed from 'index' to match DB schema
  content: string
  metadata: any // Using specific type if available
  chunk_type: 'rule' | 'example' | 'general'  // DB column: chunk_type_enum
  // Add status for UI state
  isEditing?: boolean
  isPinned?: boolean
}

interface UseChunksReturn {
  chunks: ChunkData[]
  isLoading: boolean
  error: string | null
  refreshChunks: () => Promise<void>
  updateChunk: (chunkId: string, newContent?: string, isPinned?: boolean, chunkType?: 'rule' | 'example' | 'general') => Promise<void>
}

export function useChunks(documentId: string | null): UseChunksReturn {
  const [chunks, setChunks] = useState<ChunkData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchChunks = useCallback(async () => {
    if (!documentId) {
      setChunks([])
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/rag/chunks?documentId=${documentId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch chunks')
      }
      
      const data = await res.json()
      setChunks(data.chunks || [])
    } catch (err: any) {
      console.error('Error fetching chunks:', err)
      setError(err.message || 'Unknown error')
      setChunks([])
    } finally {
      setIsLoading(false)
    }
  }, [documentId])

  const updateChunk = async (chunkId: string, newContent?: string, isPinned?: boolean, chunkType?: 'rule' | 'example' | 'general') => {
    try {
      const res = await fetch(`/api/rag/chunks/${chunkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent, isPinned, chunkType })
      })
      
      if (!res.ok) throw new Error('Update failed')
      
      // Optimistic update or refresh?
      // Refreshing is safer to get the robust backend state
      await fetchChunks()
    } catch (err: any) {
      console.error('Error updating chunk:', err)
      throw err
    }
  }

  useEffect(() => {
    fetchChunks()
  }, [fetchChunks])

  return {
    chunks,
    isLoading,
    error,
    refreshChunks: fetchChunks,
    updateChunk
  }
}

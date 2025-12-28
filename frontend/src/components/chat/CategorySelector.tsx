'use client'

// =============================================================================
// CategorySelector - Category Selection UI for Chat (Phase 14.5)
// =============================================================================
// Purpose: Allow users to select a category for category-scoped RAG and Memory
// Used in: Independent Chat pages, AssistantPanel where category context is needed
// =============================================================================

import { useState, useEffect } from 'react'

interface CategorySelectorProps {
  /** Selected category value (null = all categories) */
  value: string | null
  /** Callback when category changes */
  onChange: (category: string | null) => void
  /** Additional CSS classes */
  className?: string
}

export default function CategorySelector({ 
  value, 
  onChange, 
  className = '' 
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // ---------------------------------------------------------------------------
  // Fetch categories from user's documents
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/documents/list?limit=100')
        if (response.ok) {
          const data = await response.json()
          // Extract unique categories from documents
          const uniqueCategories = Array.from(
            new Set(data.documents?.map((doc: any) => doc.category || '미분류') || [])
          ) as string[]
          setCategories(uniqueCategories.sort())
        }
      } catch (error) {
        console.error('[CategorySelector] Failed to fetch categories:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategories()
  }, [])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label 
        htmlFor="category-selector" 
        className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1"
      >
        <span>📁</span>
        <span>카테고리</span>
      </label>
      <select
        id="category-selector"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={isLoading}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                   rounded-lg bg-white dark:bg-gray-700 
                   text-gray-900 dark:text-white
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors cursor-pointer min-w-[140px]"
        aria-label="카테고리 선택"
      >
        <option value="">전체 카테고리</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      {isLoading && (
        <span className="text-xs text-gray-400 animate-pulse">로딩...</span>
      )}
    </div>
  )
}

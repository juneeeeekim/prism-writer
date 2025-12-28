
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { RAFT_CATEGORIES } from '@/constants/raft'

// =============================================================================
// PRISM Writer - Category Combobox Component
// =============================================================================
// 파일: frontend/src/components/admin/CategoryCombobox.tsx
// 역할: 카테고리 선택 및 직접 입력을 지원하는 커스텀 콤보박스
// 특징:
// - API를 통해 기존 문서 카테고리 목록 조회
// - 검색어 입력에 따른 실시간 필터링
// - 목록에 없는 새 카테고리 직접 입력 지원
// - Premium UI: 부드러운 트랜지션, 그림자 효과
// =============================================================================

interface CategoryComboboxProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function CategoryCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = '카테고리 선택 또는 직접 입력'
}: CategoryComboboxProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  
  // inputValue는 내부 표시용, value는 부모 컴포넌트 전달용
  // 초기 로드 시 value와 동기화하지 않음 (사용자 입력을 방해하지 않기 위해)
  // 단, 외부에서 value가 변경되면 반영해야 함 -> useEffect로 처리? 
  // 여기서는 콤보박스 특성상 input 자체가 value를 대변하므로 제어 컴포넌트로 동작.
  
  // 드롭다운 닫힘 감지용 ref
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Effect: 외부 클릭 감지 (드롭다운 닫기)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Effect: 카테고리 목록 Fetch
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function fetchCategories() {
      try {
        setIsLoading(true)
        const res = await fetch('/api/categories/unique')
        
        if (!res.ok) {
          throw new Error('Failed to fetch')
        }
        
        const data = await res.json()
        setItems(data)
      } catch (error) {
        console.error('[CategoryCombobox] API Error, using fallback:', error)
        // 에러 발생 시 기본 상수 사용 (Fallback)
        setItems([...RAFT_CATEGORIES])
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategories()
  }, [])

  // ---------------------------------------------------------------------------
  // Filter Logic
  // ---------------------------------------------------------------------------
  // 입력값에 따라 필터링된 목록
  // value(사용자가 입력 중인 값)가 포함된 항목만 표시
  // 대소문자 무시, 공백 무시
  const filteredItems = items.filter((item) => {
    if (!value) return true
    const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '')
    return normalize(item).includes(normalize(value))
  })

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  const handleSelect = (item: string) => {
    onChange(item)
    setIsOpen(false)
  }

  const handleFocus = () => {
    if (!disabled) setIsOpen(true)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Input Field */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder={placeholder}
          className={`
            w-full px-4 py-2.5 pr-10 rounded-lg border bg-white dark:bg-gray-900 
            text-sm text-gray-900 dark:text-gray-100 transition-all
            focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
            ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-700'}
          `}
          aria-label="카테고리 입력 또는 선택"
          aria-expanded={isOpen}
          role="combobox"
        />
        
        {/* Chevron Icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
          <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown List */}
      {isOpen && !disabled && (
        <ul className="
          absolute z-50 w-full mt-1 max-h-60 overflow-auto 
          bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 
          rounded-lg shadow-lg py-1 animate-fadeIn
        ">
          {isLoading ? (
            <li className="px-4 py-3 text-sm text-gray-400 text-center">
              목록 불러오는 중...
            </li>
          ) : filteredItems.length === 0 ? (
            <li className="px-4 py-2">
              <button
                onClick={() => handleSelect(value)} // 현재 입력값 선택 처리
                className="w-full text-left text-sm text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-2 py-1"
              >
                 ➕ "{value}" (새 카테고리 사용)
              </button>
            </li>
          ) : (
            filteredItems.map((item, index) => (
              <li key={`${item}-${index}`}>
                <button
                  onClick={() => handleSelect(item)}
                  className={`
                    w-full text-left px-4 py-2 text-sm transition-colors
                    hover:bg-indigo-50 dark:hover:bg-indigo-900/30
                    ${value === item 
                      ? 'text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50/50 dark:bg-indigo-900/10' 
                      : 'text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  {item}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// =============================================================================
// PRISM Writer - Synthetic Data Panel Component
// =============================================================================
// 파일: frontend/src/components/admin/SyntheticDataPanel.tsx
// 역할: RAFT 파인튜닝용 합성 Q&A 데이터 생성 UI
// 생성일: 2025-12-28
//
// [Phase 2] P2-01 ~ P2-05: UI 컴포넌트 개발
// - P2-01: 컴포넌트 골격 및 상태 변수
// - P2-02: 2단계 확인 모달 및 인증 로딩 Hotfix
// - P2-03: 로딩 및 결과 표시 UI
// - P2-05: 오늘 생성량 조회
//
// [Phase 3] API 연동
// - generateSyntheticDataAPI 호출
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { generateSyntheticDataAPI } from '@/lib/api/raft'
import { RAFT_CATEGORIES, DEFAULT_RAFT_CATEGORY, RAFT_AVAILABLE_MODELS } from '@/constants/raft'
import CategoryCombobox from '@/components/admin/CategoryCombobox'
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// 로컬 컴포넌트: Spinner
// =============================================================================

/** 스피너 UI (로컬) */
const Spinner = ({ size = 'md', color = 'indigo' }: { size?: 'sm' | 'md' | 'lg', color?: string }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }
  
  const colorClasses: Record<string, string> = {
    indigo: 'text-indigo-600',
    white: 'text-white'
  }

  return (
    <svg 
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color] || 'text-indigo-600'}`} 
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// =============================================================================
// 타입 정의
// =============================================================================

interface GenerationResult {
  success: boolean
  generated: number
  errors: string[]
  data?: Array<{ question: string; answer: string }>
}

interface SyntheticDataPanelProps {
  /** 개발 모드 여부 (인증 우회) */
  isDevMode?: boolean
  /** 초기 카테고리 (URL 파라미터 등) */
  initialCategory?: string
}

// =============================================================================
// 메인 컴포넌트
// =============================================================================

export default function SyntheticDataPanel({ 
  isDevMode = false, 
  initialCategory 
}: SyntheticDataPanelProps) {
  // ---------------------------------------------------------------------------
  // 상태 변수
  // ---------------------------------------------------------------------------
  
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory || DEFAULT_RAFT_CATEGORY
  )
  const [count, setCount] = useState<number>(10)
  const [context, setContext] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>(
    getModelForUsage('raft.generation') || RAFT_AVAILABLE_MODELS[0].id
  )
  const [contextSource, setContextSource] = useState<'manual' | 'db'>('manual')
  const [isFetchingContext, setIsFetchingContext] = useState<boolean>(false)
  // [Phase A] A-01: 기존 청크 전체 활용 상태
  const [useExistingChunks, setUseExistingChunks] = useState<boolean>(false)

  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [isConfirming, setIsConfirming] = useState<boolean>(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [todayCount, setTodayCount] = useState<number>(0)

  // ---------------------------------------------------------------------------
  // 인증 및 로딩 [P2-02 Hotfix]
  // ---------------------------------------------------------------------------
  
  const { user, loading: authLoading } = useAuth()
  const isAuthorized = user !== null || isDevMode

  // ---------------------------------------------------------------------------
  // 생성 실행 (API 연동)
  // ---------------------------------------------------------------------------
  
  const handleGenerate = async () => {
    setIsGenerating(true)
    setIsConfirming(false)
    setResult(null)
    
    try {
      // [Phase A] A-05: useExistingChunks 파라미터 전달
      const shouldUseChunks = useExistingChunks && contextSource === 'db'
      const response = await generateSyntheticDataAPI(
        shouldUseChunks ? '' : context,  // 청크 사용 시 빈 문자열
        count, 
        selectedCategory, 
        selectedModel,
        shouldUseChunks  // [Phase A] 신규 파라미터
      )
      
      setResult({
        success: response.success,
        generated: response.generated,
        errors: response.errors || [],
        data: response.data
      })
      
      if (response.success) {
        setTodayCount(prev => prev + response.generated)
      }
    } catch (err: any) {
      setResult({
        success: false,
        generated: 0,
        errors: [err.message || '알 수 없는 오류가 발생했습니다.']
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleInitialGenerate = () => {
    // [Phase A] A-05: useExistingChunks 모드일 때는 context 검증 스킵
    const shouldUseChunks = useExistingChunks && contextSource === 'db'
    
    if (!shouldUseChunks && context.trim().length < 100) {
      alert('참고 자료는 최소 100자 이상 입력해야 합니다.')
      return
    }
    
    if (shouldUseChunks && !selectedCategory) {
      alert('청크 활용 모드는 카테고리 선택이 필수입니다.')
      return
    }
    
    setIsConfirming(true)
  }

  // ---------------------------------------------------------------------------
  // UI 렌더링 (인증 상태 체크) 
  // [Fix] DevMode일 때는 로딩 스킵
  // ---------------------------------------------------------------------------
  
  if (authLoading && !isDevMode) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-gray-500 dark:text-gray-400 animate-pulse">사용자 권한 확인 중...</p>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900/30 p-12 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">접근 권한이 없습니다</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">관리자 계정으로 로그인이 필요합니다.</p>
        <button 
          onClick={() => window.location.href = '/login'}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          로그인 페이지로 이동
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🏗️ 합성 데이터 생성
            <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">RAFT Training Data</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            입력한 텍스트를 분석하여 파인튜닝용 Q&A 세트를 자동 생성합니다.
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">오늘 생성량</div>
          <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {todayCount} <span className="text-gray-400 dark:text-gray-600 font-normal">/ 500</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ================================================================= */}
        {/* [P4-01] 카테고리 선택 UI 추가 */}
        {/* ================================================================= */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
            🏷️ 카테고리 (Knowledge Domain)
          </label>
          <CategoryCombobox
            value={selectedCategory}
            onChange={setSelectedCategory}
            disabled={isGenerating}
          />
          <p className="text-[10px] text-gray-400">
            생성된 Q&A는 선택한 카테고리로 저장됩니다.
          </p>
        </div>

        {/* Context Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              📚 참고 자료 (Context)
              <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setContextSource('manual')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    contextSource === 'manual' 
                      ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  ✏️ 직접 입력
                </button>
                <button
                  type="button"
                  onClick={() => setContextSource('db')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    contextSource === 'db' 
                      ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  🗄️ DB에서 불러오기
                </button>
              </div>
              <span className={`text-[10px] ${context.length > 5000 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                {context.length.toLocaleString()} / 5,000 자
              </span>
            </div>
          </div>

          {contextSource === 'db' && (
            <div className="mb-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-xs text-indigo-800 dark:text-indigo-200">
                  <span className="font-bold">선택된 카테고리:</span> {selectedCategory}
                  <p className="mt-0.5 opacity-80">이 카테고리의 문서 내용을 자동으로 불러옵니다.</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (isFetchingContext) return
                    const confirmMsg = context.length > 0 ? '현재 입력된 내용이 덮어씌워집니다. 계속하시겠습니까?' : null
                    if (confirmMsg && !confirm(confirmMsg)) return

                    try {
                      setIsFetchingContext(true)
                      const res = await fetch('/api/raft/context', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ category: selectedCategory })
                      })
                      const data = await res.json()
                      
                      if (!res.ok) throw new Error(data.error || 'Fetch failed')
                      if (!data.context) {
                        alert(data.message || '해당 카테고리의 문서를 찾을 수 없습니다.')
                      } else {
                        setContext(data.context)
                      }
                    } catch (e: any) {
                      alert('불러오기 실패: ' + e.message)
                    } finally {
                      setIsFetchingContext(false)
                    }
                  }}
                  disabled={isFetchingContext || useExistingChunks}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isFetchingContext ? <Spinner size="sm" color="white" /> : '📥 문서 불러오기'}
                </button>
              </div>
              
              {/* [Phase A] A-01: Existing Chunks 사용 체크박스 */}
              <label className="flex items-center gap-2 text-sm mt-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                <input
                  type="checkbox"
                  checked={useExistingChunks}
                  onChange={(e) => setUseExistingChunks(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  aria-label="기존 청크 전체 활용"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  📦 해당 카테고리의 모든 청크를 컨텍스트로 자동 활용
                </span>
              </label>
            </div>
          )}

          {/* [Phase A] A-02: 조건부 렌더링 - useExistingChunks 시 안내 메시지 표시 */}
          {useExistingChunks && contextSource === 'db' ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 transition-all duration-300">
              <p className="text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
                <span className="text-lg">✨</span>
                선택된 카테고리 <strong className="font-bold">'{selectedCategory}'</strong>의 모든 청크를 자동으로 활용합니다.
              </p>
              <p className="text-blue-600 dark:text-blue-400 text-xs mt-1 ml-7">
                (직접 입력 없이 DB에 저장된 문서 청크를 기반으로 Q&A를 생성합니다)
              </p>
            </div>
          ) : (
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={contextSource === 'db' 
                ? "상단의 '문서 불러오기' 버튼을 클릭하면 내용이 채워집니다. (필요 시 수정 가능)" 
                : "합성 데이터의 기반이 될 텍스트를 입력해주세요. (예: 시스템 메뉴얼, 정책 문서 등)"
              }
              className="w-full h-48 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 
                         text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent 
                         transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Generation Count */}
          <div className="w-full sm:w-1/3 space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              🏭 생성 개수
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="50"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="w-12 text-center py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold rounded border border-indigo-100 dark:border-indigo-800">
                {count}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-1/3 space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              🤖 모델 선택
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 
                         text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
            >
              {RAFT_AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-lg p-3 border border-indigo-100/50 dark:border-indigo-800/30">
            <h3 className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider mb-2">Generation Info</h3>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc list-inside">
              <li>모델: <span className="text-indigo-600 dark:text-indigo-400 font-medium">{RAFT_AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel}</span></li>
              <li>언어: <span className="font-medium text-gray-800 dark:text-gray-200">한국어 (Korean)</span></li>
              <li>카테고리: <span className="font-medium text-indigo-600 dark:text-indigo-400">{selectedCategory}</span></li>
            </ul>
          </div>
        </div>


        {/* Action Button */}
        <div className="pt-4">
          {!isConfirming ? (
            <button
              onClick={handleInitialGenerate}
              disabled={isGenerating || !context.trim()}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg
                ${isGenerating || !context.trim() 
                  ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:scale-[1.01] active:scale-[0.99]'
                }`}
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <Spinner size="sm" color="white" />
                  <span>합성 데이터 생성 중...</span>
                </div>
              ) : (
                '🚀 합성 데이터 생성 시작'
              )}
            </button>
          ) : (
            <div className="flex flex-col gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 font-bold text-sm">
                <span>⚠️</span> 생성 확인
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                입력하신 자료로부터 <strong>{count}개</strong>의 Q&A 세트를 생성합니다.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleGenerate}
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors"
                >
                  예, 생성을 시작합니다
                </button>
                <button
                  onClick={() => setIsConfirming(false)}
                  className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Section (Modal-like) */}
      {result && result.success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                ✅ 생성 결과
                <span className="text-xs font-normal text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                  성공 {result.generated}건
                </span>
              </h3>
              <button 
                onClick={() => setResult(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {result.data?.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase">Q&A #{idx + 1}</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Q: {item.question}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">A: {item.answer}</div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setResult(null)}
                className="w-full py-3 bg-gray-900 dark:bg-indigo-600 text-white font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-indigo-700 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Result */}
      {result && !result.success && (
        <div className="mx-6 mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-800 dark:text-red-200 font-bold mb-1">❌ 생성 실패</p>
          {result.errors.map((error, idx) => (
            <p key={idx} className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ))}
        </div>
      )}
    </div>
  )
}

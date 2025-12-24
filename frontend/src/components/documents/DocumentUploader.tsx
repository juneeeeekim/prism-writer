// =============================================================================
// PRISM Writer - Document Uploader Component
// =============================================================================
// 파일: frontend/src/components/documents/DocumentUploader.tsx
// 역할: 문서 파일 업로드 UI (드래그 앤 드롭 + 파일 선택)
// =============================================================================

'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useToast } from '@/hooks/useToast'

// =============================================================================
// 타입 정의
// =============================================================================

interface DocumentUploaderProps {
  onUploadSuccess?: (documentId: string) => void
  className?: string
}

// =============================================================================
// 상수
// =============================================================================

const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB (Supabase Free Plan 최대치)

// [Risk Mitigation] 대용량 PDF 경고 임계값 (5MB 이상 PDF는 처리 시간이 길어질 수 있음)
const PDF_WARNING_SIZE = 5 * 1024 * 1024 // 5MB

// =============================================================================
// Component
// =============================================================================

export default function DocumentUploader({ onUploadSuccess, className = '' }: DocumentUploaderProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // ---------------------------------------------------------------------------
  // 파일 검증
  // ---------------------------------------------------------------------------
  const validateFile = (file: File): string | null => {
    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return `파일 크기가 너무 큽니다. 최대 50MB까지 업로드 가능합니다. (현재: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`
    }

    // 파일 타입 검증
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return `지원되지 않는 파일 형식입니다. 허용된 형식: PDF, DOCX, TXT, MD`
    }

    if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
      return `지원되지 않는 파일 형식입니다. 허용된 형식: PDF, DOCX, TXT, MD`
    }

    return null
  }
  
  // ---------------------------------------------------------------------------
  // [Risk Mitigation] 대용량 PDF 경고 체크
  // ---------------------------------------------------------------------------
  const checkLargePDFWarning = (file: File): boolean => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (fileExtension === 'pdf' && file.size > PDF_WARNING_SIZE) {
      toast.warning(`대용량 PDF 파일입니다 (${(file.size / (1024 * 1024)).toFixed(1)}MB). 처리 시간이 오래 걸릴 수 있습니다.`)
      return true
    }
    return false
  }

  // ---------------------------------------------------------------------------
  // 파일 업로드 처리
  // ---------------------------------------------------------------------------
  const uploadFile = async (file: File) => {
    // 검증
    const validationError = validateFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    
    // [Risk Mitigation] 대용량 PDF 경고 표시 (업로드는 계속 진행)
    checkLargePDFWarning(file)

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // FormData 생성
      const formData = new FormData()
      formData.append('file', file)

      // API 호출
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '업로드 중 오류가 발생했습니다.')
      }

      // 성공
      setUploadProgress(100)
      toast.success(`"${file.name}" 파일이 성공적으로 업로드되었습니다.`)
      
      if (onUploadSuccess && data.documentId) {
        onUploadSuccess(data.documentId)

        // [Phase 2: Client-Triggered Processing]
        // Vercel Timeout 방지를 위해 클라이언트에서 별도로 처리 요청을 보냄.
        // "Fire and Forget" 패턴: await 하지 않고 요청만 보냄 (UI 블로킹 방지)
        // 단, 에러 로깅을 위해 catch는 붙임.
        fetch('/api/documents/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: data.documentId })
        }).then(res => {
          if (!res.ok) console.error('Processing trigger failed:', res.statusText)
          else console.log('Processing triggered successfully')
        }).catch(err => {
          console.error('Processing trigger error:', err)
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : '파일 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // ---------------------------------------------------------------------------
  // 드래그 앤 드롭 핸들러
  // ---------------------------------------------------------------------------
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      uploadFile(files[0])
    }
  }

  // ---------------------------------------------------------------------------
  // 파일 선택 핸들러
  // ---------------------------------------------------------------------------
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadFile(files[0])
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className={className}>
      {/* -----------------------------------------------------------------------
          드래그 앤 드롭 영역
          ----------------------------------------------------------------------- */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
        `}
        onClick={!isUploading ? handleButtonClick : undefined}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            e.preventDefault()
            handleButtonClick()
          }
        }}
        aria-label="파일 업로드 영역"
      >
        {/* 아이콘 */}
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* 텍스트 */}
        <div className="text-sm">
          {isUploading ? (
            <>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                업로드 중...
              </p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {uploadProgress}%
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                <span className="text-indigo-600 dark:text-indigo-400">클릭</span>하거나 파일을 드래그하여 업로드
              </p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                PDF, DOCX, TXT, MD (최대 50MB)
              </p>
            </>
          )}
        </div>

        {/* 진행 바 */}
        {isUploading && (
          <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
              role="progressbar"
              aria-valuenow={uploadProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="파일 선택"
        />
      </div>
    </div>
  )
}

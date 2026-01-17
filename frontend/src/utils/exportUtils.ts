// =============================================================================
// PRISM Writer - Export Utilities
// =============================================================================
// 파일: frontend/src/utils/exportUtils.ts
// 역할: 클라이언트 사이드 파일 다운로드 및 파일명 처리 유틸리티
// 사용: EditorPage에서 문서 내보내기 시 사용
// =============================================================================

/**
 * 텍스트 내용을 파일로 다운로드 트리거
 * 
 * @param filename - 확장자를 포함한 파일명 (예: 'document.md')
 * @param content - 파일 내용 (텍스트)
 * @param mimeType - MIME 타입 (기본: text/plain)
 */
export function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  try {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    return true
  } catch (error) {
    console.error('File download failed:', error)
    return false
  }
}

/**
 * 파일명으로 부적절한 특수문자 제거 및 기본값 처리
 * 
 * @param name - 원본 파일명 (문서 제목 등)
 * @returns 안전한 파일명
 */
export function sanitizeFilename(name: string | null | undefined): string {
  if (!name || name.trim() === '') {
    return 'untitled'
  }
  
  // 1. 공백은 언더스코어(_) 또는 하이픈(-)으로 대체하면 좋지만, 
  //    Windows 파일명 규칙상 공백 허용되므로 유지하되, 
  //    시스템 예약 문자(< > : " / \ | ? *) 제거에 집중
  // 2. Control characters 제거
  
  // Windows/Unix Forbidden chars: < > : " / \ | ? *
  const sanitized = name.replace(/[<>:"/\\|?*]/g, '').trim()
  
  return sanitized || 'untitled'
}

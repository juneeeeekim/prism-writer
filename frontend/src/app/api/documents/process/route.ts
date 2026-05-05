// 디렉토리 경로: frontend/src/app/api/documents/process/
// 파일명: route.ts
// 파일 코드의 역할/설명: 업로드된 문서 처리 API의 Next.js route entrypoint를 제공한다.

import { handleProcessDocument } from './handler'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleProcessDocument(request)
}

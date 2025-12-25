
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/rag/chunks?documentId={id}
 * 
 * Fetches chunks for a specific document.
 * Requires authentication and ownership check.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const documentId = searchParams.get('documentId')

  if (!documentId) {
    return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
  }

  const supabase = createClient()

  // 1. Auth Check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Ownership Check (Implicit via JOIN or RLS, but explicit check is safer if RLS is tricky on chunks directly)
    // Checking rag_documents ownership first
    const { data: doc, error: docError } = await supabase
      .from('rag_documents')
      .select('user_id')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (doc.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Fetch Chunks
    // Ordering by chunk_index to maintain document flow
    const { data: chunks, error: chunkError } = await supabase
      .from('rag_chunks')
      .select('id, chunk_index, content, metadata')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })

    if (chunkError) {
      console.error('Error fetching chunks:', chunkError)
      return NextResponse.json({ error: 'Failed to fetch chunks' }, { status: 500 })
    }

    return NextResponse.json({ chunks })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

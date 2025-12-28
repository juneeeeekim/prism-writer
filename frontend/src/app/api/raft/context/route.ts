
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FEATURE_FLAGS } from '@/config/featureFlags'

// =============================================================================
// Constants
// =============================================================================

const MAX_CHUNKS = 20
const MAX_CONTEXT_LENGTH = 15000 // Context Explosion Guard

// =============================================================================
// Helper Functions
// =============================================================================

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

// =============================================================================
// API Handler
// =============================================================================

export async function POST(request: NextRequest) {
  // 1. Feature Flag Check
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return NextResponse.json({ error: 'RAFT features disabled' }, { status: 503 })
  }

  try {
    const { category } = await request.json()

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 2. Auth Check (Reuse logic or simplified check)
    // For now, relying on Service Role Key but restricting to Admin UI usage context
    // Ideally verify user token here as in generate route

    // 3. Get Document IDs for Category
    // Migration 037 links document_chunks to user_documents, so we use that.
    const { data: documents, error: docError } = await supabase
      .from('user_documents') 
      .select('id')
      .eq('category', category)
    
    if (docError) {
      console.error('[RAFT Context] Doc fetch error:', docError)
      return NextResponse.json({ error: `Doc fetch failed: ${docError.message}` }, { status: 500 })
    }
    
    if (!documents || documents.length === 0) {
      return NextResponse.json({ context: '', message: 'No documents found for this category (user_documents)' })
    }

    const docIds = documents.map(d => d.id)

    // 4. Get Chunks (Schema Guard Implemented)
    // Attempt standard 'content' column first
    let chunks: any[] | null = null
    let chunkError: any = null

    const firstAttempt = await supabase
      .from('document_chunks')
      .select('content') 
      .in('document_id', docIds)
      .limit(MAX_CHUNKS * 2) 

    chunks = firstAttempt.data
    chunkError = firstAttempt.error

    // SCHEMA GUARD: If 'content' column doesn't exist, try 'chunk_content' (common alternative)
    if (chunkError && chunkError.code === 'PGRST204') { // Column not found error code roughly
       console.warn('[RAFT Context] "content" column not found, trying "chunk_content"')
       const retry = await supabase
        .from('document_chunks')
        .select('chunk_content')
        .in('document_id', docIds)
        .limit(MAX_CHUNKS * 2)
       
       chunks = retry.data
       chunkError = retry.error
    }

    if (chunkError) {
      console.error('[RAFT Context] Chunk fetch error:', chunkError)
      // Graceful degradation: Return empty context instead of 500 hard crash
      return NextResponse.json({ 
        context: '', 
        warning: 'Failed to fetch chunks (Schema mismatch or DB error)',
        error: chunkError.message
      })
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ context: '', message: 'No chunks found' })
    }

    // 5. Context Assembly (Limit Guard)
    let fullContext = ''
    let totalLength = 0
    
    // Shuffle chunks for variety (simple randomization)
    const shuffled = chunks.sort(() => 0.5 - Math.random()).slice(0, MAX_CHUNKS)

    for (const chunk of shuffled) {
      const text = (chunk as any).content || (chunk as any).chunk_content || (chunk as any).text
      if (!text) continue
      
      if (totalLength + text.length > MAX_CONTEXT_LENGTH) {
        break // Stop if limit reached
      }

      fullContext += text + '\n\n---\n\n'
      totalLength += text.length
    }

    return NextResponse.json({ 
      context: fullContext.trim(),
      meta: {
        docCount: docIds.length,
        chunkCount: shuffled.length,
        totalLength
      }
    })

  } catch (error: any) {
    console.error('[RAFT Context] Internal Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

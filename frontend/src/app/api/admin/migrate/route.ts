
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedText, EMBEDDING_CONFIG } from '@/lib/rag/embedding'

// Force dynamic to query DB
export const dynamic = 'force-dynamic'

/**
 * Migration Status Response
 */
interface MigrationStatus {
  total_chunks: number
  migrated_chunks: number
  pending_chunks: number
  current_model: string
}

/**
 * GET: Get Migration Status
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Get total chunks count
    const { count: totalCount, error: countError } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    // 2. Get migrated chunks count (where model_id matches current config)
    const { count: migratedCount, error: migratedError } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('embedding_model_id', EMBEDDING_CONFIG.modelId)

    if (migratedError) throw migratedError

    const status: MigrationStatus = {
      total_chunks: totalCount || 0,
      migrated_chunks: migratedCount || 0,
      pending_chunks: (totalCount || 0) - (migratedCount || 0),
      current_model: EMBEDDING_CONFIG.modelId,
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('[Migration API] Stats Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST: Execute Batch Migration
 * Body: { limit: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const limit = body.limit || 10 // Process 10 items by default (to avoid timeout)
    
    // Auth Check (Optional: Check if user is admin?)
    // For now, we allow authenticated users for this "Admin" tool used in internal deployment
    
    const supabase = await createClient()

    // 1. Fetch pending chunks
    // Prioritize chunks where model doesn't match
    let chunks: any[] = []

    const { data: mismatchChunks, error: fetchError } = await supabase
      .from('document_chunks')
      .select('id, content')
      .neq('embedding_model_id', EMBEDDING_CONFIG.modelId) // Not current model
      .limit(limit)

    if (fetchError) throw fetchError
    
    if (mismatchChunks && mismatchChunks.length > 0) {
      chunks = mismatchChunks
    } else {
        // If no explicit mismatches, check for NULLs (though specific check above handles it if neq includes nulls? 
        // Supabase/PostgREST neq might NOT include nulls. is('null') check is safer)
       const { data: nullChunks, error: nullError } = await supabase
        .from('document_chunks')
        .select('id, content')
        .is('embedding_model_id', null)
        .limit(limit)
      
      if (nullError) throw nullError
      if (nullChunks) chunks = nullChunks
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ message: 'No pending chunks to migrate.', processed: 0 })
    }

    console.log(`[Migration API] Processing ${chunks.length} chunks...`)

    // 2. Process chunks
    let processed = 0
    const errors: any[] = []

    for (const chunk of chunks) {
      try {
        // Generate new embedding
        const embedding = await embedText(chunk.content)

        // Update chunk
        const { error: updateError } = await supabase
          .from('document_chunks')
          .update({
            embedding,
            embedding_model_id: EMBEDDING_CONFIG.modelId,
            embedding_dim: EMBEDDING_CONFIG.dimensions,
            embedded_at: new Date().toISOString()
          })
          .eq('id', chunk.id)

        if (updateError) throw updateError

        processed++
      } catch (err) {
        console.error(`[Migration API] Error processing chunk ${chunk.id}:`, err)
        errors.push({ id: chunk.id, error: err instanceof Error ? err.message : String(err) })
      }
    }

    return NextResponse.json({
      message: 'Batch processing complete',
      processed,
      errors
    })

  } catch (error) {
    console.error('[Migration API] Execution Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

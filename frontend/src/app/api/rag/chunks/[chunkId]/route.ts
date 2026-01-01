
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { embedText } from '@/lib/rag/embedding'

/**
 * PATCH /api/rag/chunks/[chunkId]
 * 
 * Updates a specific chunk's content or metadata.
 * Automatically regenerates embedding if content changes.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { chunkId: string } }
) {
  const chunkId = params.chunkId
  if (!chunkId) {
    return NextResponse.json({ error: 'Missing chunkId' }, { status: 400 })
  }

  const body = await req.json()
  const { content, isPinned, chunkType } = body

  if (content === undefined && isPinned === undefined && chunkType === undefined) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Auth Check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Ownership Check & Fetch Current Data
    // We need to join with rag_documents to check user_id
    const { data: chunk, error: fetchError } = await supabase
      .from('rag_chunks')
      .select(`
        id,
        content,
        metadata,
        document_id,
        rag_documents!inner(user_id)
      `)
      .eq('id', chunkId)
      .single()

    if (fetchError || !chunk) {
      return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })
    }

    // Check if the document belongs to the user
    // @ts-ignore: Supabase types might be strict about joins
    if (chunk.rag_documents?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Prepare Update
    const updates: any = {}
    let newMetadata = { ...(chunk.metadata as object) }

    // Logic: If content changed, regenerate embedding
    if (content !== undefined && content !== chunk.content) {
      updates.content = content
      
      // [Risk Mitigation] Semantic Drift
      // Generate new embedding for the updated content
      try {
        const newEmbedding = await embedText(content)
        updates.embedding = newEmbedding
      } catch (embedErr) {
        console.error('Failed to generate embedding:', embedErr)
        return NextResponse.json({ error: 'Failed to generate embedding for new content' }, { status: 500 })
      }
    }

    // Logic: Pinning
    if (isPinned !== undefined) {
      newMetadata = { ...newMetadata, isPinned }
      updates.metadata = newMetadata
    }

    // Logic: Chunk Type Update
    if (chunkType !== undefined && ['rule', 'example', 'general'].includes(chunkType)) {
      updates.chunk_type = chunkType
    }

    // 4. Perform Update
    const { error: updateError } = await supabase
      .from('rag_chunks')
      .update(updates)
      .eq('id', chunkId)

    if (updateError) {
      console.error('Update failed:', updateError)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


import { createClient } from '@supabase/supabase-js'
import { generateSyntheticData } from '../src/lib/raft/syntheticDataGenerator'
import fs from 'fs'
import path from 'path'

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  console.log(`[RAFT Collector] Loading env from ${envPath}`)
  const envConfig = fs.readFileSync(envPath, 'utf-8')
  envConfig.split('\n').forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('#')) return
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = value
    }
  })
}

// Logger definition
const log = (msg: string) => console.log(`[RAFT Collector] ${msg}`)

async function main() {
  log('Starting data collection...')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error('Error: Missing environment variables.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Check existing count
  const { count: currentCount } = await supabase
    .from('raft_dataset')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'synthetic')
  
  log(`Current dataset size: ${currentCount}`)

  if ((currentCount || 0) >= 500) {
    log('Target (500) already reached. Exiting.')
    return
  }

  const targetNeeded = 500 - (currentCount || 0)
  log(`Need to generate: ${targetNeeded} pairs`)

  // 2. Fetch candidate chunks (length > 500)
  // Table name is 'rag_chunks'
  const { data: chunks, error: chunkError } = await supabase
    .from('rag_chunks')
    .select('id, content') 
    .limit(1000)
  
  if (chunkError || !chunks) {
    console.error('Failed to fetch chunks:', chunkError)
    console.log('Hint: Check if "rag_chunks" table exists and visible to service role.')
    return
  }

  // Filter by length in memory
  const candidates = chunks.filter(c => c.content && c.content.length > 300) // Lowered to 300 to be safe
  log(`Found ${candidates.length} candidate chunks (>300 chars)`)

  if (candidates.length === 0) {
    log('No suitable chunks found.')
    return
  }

  let generatedTotal = 0
  
  // 3. Loop until target met
  while (generatedTotal < targetNeeded) {
    // Pick random chunk
    const chunk = candidates[Math.floor(Math.random() * candidates.length)]
    
    // Generate 3-5 pairs per chunk
    const countToGen = Math.min(5, targetNeeded - generatedTotal)
    
    log(`Generating ${countToGen} pairs from chunk ${chunk.id.slice(0, 8)}...`)
    
    const generateTextFn = async (prompt: string) => {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)
        return data.choices[0].message.content
    }

    try {
        const result = await generateSyntheticData(
            { context: chunk.content, count: countToGen },
            generateTextFn
        )

        if (result.success && result.data.length > 0) {
            // Insert
            const rows = result.data.map(d => ({
                user_query: d.question,
                context: chunk.content,
                gold_answer: d.answer,
                source: 'synthetic',
                verified: false
            }))
            
            const { error: insertError } = await supabase.from('raft_dataset').insert(rows)
            
            if (insertError) {
                console.error('Insert failed:', insertError)
            } else {
                generatedTotal += rows.length
                log(`Saved ${rows.length} pairs. Total session: ${generatedTotal}`)
            }
        } else {
            log(`Generation failed for this chunk. Errors: ${result.errors.join(', ')}`)
        }
    } catch (e: any) {
        log(`Error generating: ${e.message}`)
    }

    // Optional delay to be nice
    await new Promise(r => setTimeout(r, 1000))
  }

  log('Collection complete!')
}

main().catch(console.error)

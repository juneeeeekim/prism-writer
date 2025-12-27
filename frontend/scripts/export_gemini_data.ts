
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { convertToGeminiFormat } from '../src/lib/raft/converter';
import { RAFTData } from '../src/lib/raft/types';

// =============================================================================
// Phase 5: Gemini JSONL Export Script
// Risk 2 Mitigation: Batch processing for memory safety
// Risk 3 Mitigation: JSON.stringify handles special character escaping
// =============================================================================

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// =============================================================================
// Configuration
// =============================================================================
const BATCH_SIZE = 100; // Risk 2: Process in batches to prevent OOM

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// Main Export Function
// =============================================================================
async function main() {
  const startTime = Date.now();
  console.log('🚀 Starting Gemini Data Export...');
  console.log(`📊 Batch Size: ${BATCH_SIZE} rows per batch`);
  console.log('📡 Fetching data from raft_dataset...');

  // ==========================================================================
  // Step 1: Get total count first
  // ==========================================================================
  const { count, error: countError } = await supabase
    .from('raft_dataset')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting data:', countError.message);
    process.exit(1);
  }

  const totalRows = count || 0;
  console.log(`📈 Total rows in raft_dataset: ${totalRows}`);

  if (totalRows === 0) {
    console.warn('⚠️ No data found in raft_dataset.');
    process.exit(0);
  }

  // ==========================================================================
  // Step 2: Batch Processing (Risk 2 Mitigation)
  // ==========================================================================
  const outputPath = path.resolve(process.cwd(), 'training_data.jsonl');
  const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf-8' });
  
  let successCount = 0;
  let failCount = 0;
  let batchNumber = 0;
  const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

  for (let offset = 0; offset < totalRows; offset += BATCH_SIZE) {
    batchNumber++;
    console.log(`⏳ Processing batch ${batchNumber}/${totalBatches} (rows ${offset + 1}-${Math.min(offset + BATCH_SIZE, totalRows)})...`);

    const { data: batchData, error: batchError } = await supabase
      .from('raft_dataset')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (batchError) {
      console.error(`❌ Error fetching batch ${batchNumber}:`, batchError.message);
      continue; // Skip this batch but continue with others
    }

    if (!batchData || batchData.length === 0) {
      console.warn(`⚠️ Batch ${batchNumber} returned no data.`);
      continue;
    }

    // ==========================================================================
    // Step 3: Convert and Write (Risk 3: JSON.stringify handles escaping)
    // ==========================================================================
    for (const row of batchData) {
      try {
        const formatted = convertToGeminiFormat(row as RAFTData);
        // Risk 3: JSON.stringify automatically escapes special characters (\n, ", etc.)
        const jsonLine = JSON.stringify(formatted);
        writeStream.write(jsonLine + '\n');
        successCount++;
      } catch (err: any) {
        console.warn(`⚠️ Skipping row ${row.id}: ${err.message}`);
        failCount++;
      }
    }
  }

  writeStream.end();

  // ==========================================================================
  // Step 4: Summary Report
  // ==========================================================================
  const endTime = Date.now();
  const durationSec = ((endTime - startTime) / 1000).toFixed(2);

  console.log('--------------------------------------------------');
  console.log(`🎉 Export Completed!`);
  console.log(`📄 Output File: ${outputPath}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Skipped: ${failCount}`);
  console.log(`⏱️ Duration: ${durationSec} seconds`);
  console.log(`📊 Performance: ${(successCount / parseFloat(durationSec)).toFixed(1)} rows/sec`);
  console.log('--------------------------------------------------');
}

main();


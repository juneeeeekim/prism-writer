
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) process.exit(1);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const dummyData = [
  {
    user_query: 'What is PrismLM?',
    context: 'PrismLM is a AI writing assistant tool.',
    gold_answer: 'PrismLM is an AI tool for writing assistance.',
    source: 'synthetic',
    verified: true
  },
  {
    user_query: 'How to export data?',
    context: 'Go to admin panel and click export.',
    gold_answer: 'Click export in the admin panel.',
    source: 'synthetic',
    verified: true
  },
   {
    user_query: 'GEMINI Finetuning guide',
    context: 'Gemini 1.5 Flash supports JSONL format for tuning.',
    gold_answer: 'Use JSONL format for Gemini 1.5 Flash.',
    source: 'manual',
    verified: true
  }
];

async function insert() {
  console.log('Inserting dummy data...');
  const { error } = await supabase.from('raft_dataset').insert(dummyData);
  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('✅ Inserted 3 rows.');
  }
}

insert();

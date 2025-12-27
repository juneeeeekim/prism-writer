
import { convertToGeminiFormat } from '../src/lib/raft/converter';
import { RAFTData } from '../src/lib/raft/types';

// Mock Data
const mockRow: RAFTData = {
  id: 'test-id',
  created_at: new Date().toISOString(),
  user_query: 'What is deep learning?',
  context: 'Deep learning is a subset of machine learning...',
  gold_answer: 'Deep learning is a type of AI...',
  source: 'manual',
  verified: true
};

try {
  console.log('Testing convertToGeminiFormat...');
  const result = convertToGeminiFormat(mockRow);
  
  console.log('Result:', JSON.stringify(result, null, 2));

  // Validation
  if (result.messages.length !== 2) throw new Error('Expected 2 messages (user, model)');
  if (result.messages[0].role !== 'user') throw new Error('First role should be user');
  if (result.messages[1].role !== 'model') throw new Error('Second role should be model');
  
  console.log('✅ Conversion Verification Passed!');
} catch (error) {
  console.error('❌ Verification Failed:', error);
  process.exit(1);
}

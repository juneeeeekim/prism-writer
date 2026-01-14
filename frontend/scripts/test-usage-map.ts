// =============================================================================
// [v3.0] Phase 1 검증 스크립트 - Jemiel Ensemble Strategy
// =============================================================================
// 파일: frontend/scripts/test-usage-map.ts
// 역할: printUsageMap(), validateUsageMap() 실행 및 검증
// 실행: npx ts-node --skipProject scripts/test-usage-map.ts
// =============================================================================

import {
  LLM_USAGE_MAP,
  validateUsageMap,
  getAllUsageContexts,
  getUsageConfig,
  type LLMUsageContext,
  type UsageConfig,
} from '../src/config/llm-usage-map';

// =============================================================================
// [TEST 1] printUsageMap - 모든 컨텍스트 generationConfig 출력
// =============================================================================
function testPrintUsageMap(): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 [TEST 1] printUsageMap() - generationConfig 출력 확인');
  console.log('='.repeat(80));

  const contexts = getAllUsageContexts();
  let withConfig = 0;
  let withoutConfig = 0;

  for (const ctx of contexts) {
    const config = getUsageConfig(ctx);
    if (!config) {
      console.log(`  ❌ ${ctx}: (config not found)`);
      continue;
    }

    const gen = config.generationConfig;
    if (gen) {
      const genInfo = `temp=${gen.temperature}, topP=${gen.topP}, topK=${gen.topK ?? 'N/A'}`;
      console.log(`  ✅ ${ctx}: ${config.modelId} | ${genInfo}`);
      withConfig++;
    } else {
      console.log(`  ⚠️  ${ctx}: ${config.modelId} | (no generationConfig)`);
      withoutConfig++;
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`📊 결과: ${withConfig}개 설정됨, ${withoutConfig}개 미설정`);
  console.log('-'.repeat(80));

  if (withoutConfig === 0) {
    console.log('✅ TEST 1 PASSED: 모든 컨텍스트에 generationConfig가 설정되었습니다.');
  } else {
    console.log(`⚠️  TEST 1 WARNING: ${withoutConfig}개 컨텍스트에 generationConfig가 없습니다.`);
  }
}

// =============================================================================
// [TEST 2] validateUsageMap - 유효성 검증
// =============================================================================
function testValidateUsageMap(): void {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 [TEST 2] validateUsageMap() - 유효성 검증');
  console.log('='.repeat(80));

  const { valid, errors } = validateUsageMap();

  if (valid) {
    console.log('✅ TEST 2 PASSED: { valid: true, errors: [] }');
    console.log('   모든 modelId가 유효합니다.');
  } else {
    console.log('❌ TEST 2 FAILED: 유효성 검증 오류 발견');
    errors.forEach((err) => console.log(`   - ${err}`));
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`📊 결과: valid=${valid}, errors=${errors.length}개`);
  console.log('-'.repeat(80));
}

// =============================================================================
// [TEST 3] generationConfig 범위 검증 (확장 테스트)
// =============================================================================
function testGenerationConfigRanges(): void {
  console.log('\n' + '='.repeat(80));
  console.log('📐 [TEST 3] generationConfig 범위 검증');
  console.log('='.repeat(80));

  const contexts = getAllUsageContexts();
  const errors: string[] = [];

  for (const ctx of contexts) {
    const config = getUsageConfig(ctx);
    if (!config?.generationConfig) continue;

    const gen = config.generationConfig;

    // temperature: 0 ~ 2
    if (gen.temperature < 0 || gen.temperature > 2) {
      errors.push(`${ctx}: temperature=${gen.temperature} (범위: 0-2)`);
    }

    // topP: 0 ~ 1
    if (gen.topP < 0 || gen.topP > 1) {
      errors.push(`${ctx}: topP=${gen.topP} (범위: 0-1)`);
    }

    // topK: 1 ~ 100 (optional)
    if (gen.topK !== undefined && (gen.topK < 1 || gen.topK > 100)) {
      errors.push(`${ctx}: topK=${gen.topK} (범위: 1-100)`);
    }
  }

  if (errors.length === 0) {
    console.log('✅ TEST 3 PASSED: 모든 generationConfig 값이 유효 범위 내입니다.');
  } else {
    console.log('❌ TEST 3 FAILED: 범위 초과 값 발견');
    errors.forEach((err) => console.log(`   - ${err}`));
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`📊 결과: ${errors.length}개 오류`);
  console.log('-'.repeat(80));
}

// =============================================================================
// [TEST 4] Jemiel 전략 일관성 검증
// =============================================================================
function testJemielStrategyConsistency(): void {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 [TEST 4] Jemiel 전략 일관성 검증');
  console.log('='.repeat(80));

  // Lossless 컨텍스트 (temp=0.0 예상)
  const losslessContexts: LLMUsageContext[] = [
    'rag.reviewer',
    'rag.reranker',
    'rag.selfrag',
    'rag.chunking',
    'rag.rerank',
    'template.consistency',
    'template.hallucination',
    'template.regression',
    'judge.align',
    'rule.mining',
    'pattern.extraction',
    'ocr.vision',
    'premium.reviewer',
  ];

  // Creative 컨텍스트 (temp >= 0.7 예상)
  const creativeContexts: LLMUsageContext[] = [
    'rag.answer',
    'suggest.completion',
    'research.query',
    'premium.answer',
  ];

  let losslessOk = 0;
  let losslessFail = 0;
  let creativeOk = 0;
  let creativeFail = 0;

  console.log('\n[Lossless 컨텍스트 검증 (temp=0.0 예상)]');
  for (const ctx of losslessContexts) {
    const config = getUsageConfig(ctx);
    const temp = config?.generationConfig?.temperature;
    if (temp === 0.0) {
      console.log(`  ✅ ${ctx}: temp=${temp}`);
      losslessOk++;
    } else if (temp !== undefined) {
      console.log(`  ⚠️  ${ctx}: temp=${temp} (0.0 예상)`);
      losslessFail++;
    } else {
      console.log(`  ❓ ${ctx}: generationConfig 없음`);
    }
  }

  console.log('\n[Creative 컨텍스트 검증 (temp >= 0.7 예상)]');
  for (const ctx of creativeContexts) {
    const config = getUsageConfig(ctx);
    const temp = config?.generationConfig?.temperature;
    if (temp !== undefined && temp >= 0.7) {
      console.log(`  ✅ ${ctx}: temp=${temp}`);
      creativeOk++;
    } else if (temp !== undefined) {
      console.log(`  ⚠️  ${ctx}: temp=${temp} (0.7+ 예상)`);
      creativeFail++;
    } else {
      console.log(`  ❓ ${ctx}: generationConfig 없음`);
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`📊 Lossless: ${losslessOk}개 OK, ${losslessFail}개 불일치`);
  console.log(`📊 Creative: ${creativeOk}개 OK, ${creativeFail}개 불일치`);
  console.log('-'.repeat(80));

  if (losslessFail === 0 && creativeFail === 0) {
    console.log('✅ TEST 4 PASSED: Jemiel 전략 일관성 확인됨');
  } else {
    console.log('⚠️  TEST 4 WARNING: 일부 컨텍스트가 전략과 불일치');
  }
}

// =============================================================================
// Main Execution
// =============================================================================
console.log('\n');
console.log('╔' + '═'.repeat(78) + '╗');
console.log('║  🧪 Phase 1 검증 - Jemiel Ensemble Strategy (Definition of Done)          ║');
console.log('╚' + '═'.repeat(78) + '╝');

testPrintUsageMap();
testValidateUsageMap();
testGenerationConfigRanges();
testJemielStrategyConsistency();

console.log('\n');
console.log('╔' + '═'.repeat(78) + '╗');
console.log('║  ✅ 검증 완료                                                              ║');
console.log('╚' + '═'.repeat(78) + '╝');
console.log('\n');

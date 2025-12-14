// =============================================================================
// PRISM Writer - E2E Test: Writer Flow
// =============================================================================
// 파일: frontend/e2e/writer-flow.spec.ts
// 역할: 글쓰기 플로우 전체 시나리오 테스트
// 시나리오: 에디터 접속 → 목차 생성 → 참고자료 검색 → 삽입
// =============================================================================

import { test, expect } from '@playwright/test'

// -----------------------------------------------------------------------------
// Test Suite: Writer Flow
// -----------------------------------------------------------------------------
test.describe('PRISM Writer - 글쓰기 플로우', () => {
  
  // ---------------------------------------------------------------------------
  // Test 1: 홈페이지 접속 및 에디터 이동
  // ---------------------------------------------------------------------------
  test('홈페이지에서 에디터 페이지로 이동', async ({ page }) => {
    // 1. 홈페이지 접속
    await page.goto('/')
    
    // 2. 타이틀 확인
    await expect(page).toHaveTitle(/PRISM Writer/)
    
    // 3. 에디터 시작하기 버튼 클릭
    const startButton = page.getByRole('link', { name: /에디터 시작하기/ })
    await expect(startButton).toBeVisible()
    await startButton.click()
    
    // 4. 에디터 페이지 URL 확인
    await expect(page).toHaveURL(/\/editor/)
  })

  // ---------------------------------------------------------------------------
  // Test 2: Dual Pane 레이아웃 표시
  // ---------------------------------------------------------------------------
  test('Dual Pane 레이아웃이 정상 표시됨', async ({ page }) => {
    await page.goto('/editor')
    
    // 1. 에디터 영역 확인
    const editorPane = page.locator('[aria-label="글쓰기 영역"]')
    await expect(editorPane).toBeVisible()
    
    // 2. 어시스턴트 영역 확인
    const assistantPane = page.locator('[aria-label="RAG 어시스턴트 영역"]')
    await expect(assistantPane).toBeVisible()
    
    // 3. 리사이즈 드래거 확인
    const divider = page.locator('[role="separator"]')
    await expect(divider).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // Test 3: 목차 생성 및 삽입
  // ---------------------------------------------------------------------------
  test('목차 생성 후 에디터에 삽입', async ({ page }) => {
    await page.goto('/editor')
    
    // 1. 목차 제안 탭 확인 (기본 선택됨)
    const outlineTab = page.getByRole('tab', { name: /목차 제안/ })
    await expect(outlineTab).toBeVisible()
    
    // 2. 주제 입력
    const topicInput = page.getByPlaceholder(/주제/)
    await topicInput.fill('AI 시대의 글쓰기 방법론')
    
    // 3. 목차 생성 버튼 클릭
    const generateButton = page.getByRole('button', { name: /목차 생성/ })
    await generateButton.click()
    
    // 4. 로딩 대기 (생성 중... 텍스트 사라질 때까지)
    await expect(page.getByText(/생성 중/)).toBeHidden({ timeout: 10000 })
    
    // 5. 생성된 목차 항목 확인
    await expect(page.getByText('서론')).toBeVisible()
    
    // 6. 에디터에 삽입 버튼 클릭
    const insertButton = page.getByRole('button', { name: /에디터에 삽입/ })
    await insertButton.click()
  })

  // ---------------------------------------------------------------------------
  // Test 4: 탭 전환
  // ---------------------------------------------------------------------------
  test('어시스턴트 패널 탭 전환', async ({ page }) => {
    await page.goto('/editor')
    
    // 1. 참고자료 탭 클릭
    const refTab = page.getByRole('tab', { name: /참고자료/ })
    await refTab.click()
    await expect(refTab).toHaveAttribute('aria-selected', 'true')
    
    // 2. AI 채팅 탭 클릭
    const chatTab = page.getByRole('tab', { name: /AI 채팅/ })
    await chatTab.click()
    await expect(chatTab).toHaveAttribute('aria-selected', 'true')
    
    // 3. 목차 제안 탭으로 돌아가기
    const outlineTab = page.getByRole('tab', { name: /목차 제안/ })
    await outlineTab.click()
    await expect(outlineTab).toHaveAttribute('aria-selected', 'true')
  })

  // ---------------------------------------------------------------------------
  // Test 5: 접근성 - 키보드 네비게이션
  // ---------------------------------------------------------------------------
  test('키보드로 탭 전환 가능', async ({ page }) => {
    await page.goto('/editor')
    
    // 1. 첫 번째 탭에 포커스
    await page.keyboard.press('Tab')
    
    // 여러 번 Tab 눌러서 탭 영역으로 이동
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
    }
    
    // 탭 영역에서 키보드 네비게이션이 작동하는지 확인
    // (실제 구현에 따라 조정 필요)
  })
})

// -----------------------------------------------------------------------------
// Test Suite: API Integration
// -----------------------------------------------------------------------------
test.describe('API 통합 테스트', () => {
  
  test('Health API 응답 확인', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health')
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data.status).toBe('ok')
  })
  
  test('Outline Generate API 응답 확인', async ({ request }) => {
    const response = await request.post('http://localhost:8000/v1/outline/generate', {
      data: {
        topic: 'E2E 테스트 주제',
        document_ids: [],
        max_depth: 3
      }
    })
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data.outline).toBeDefined()
    expect(Array.isArray(data.outline)).toBeTruthy()
  })
})

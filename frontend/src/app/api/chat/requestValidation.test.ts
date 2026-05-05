// 디렉토리 경로: frontend/src/app/api/chat/
// 파일명: requestValidation.test.ts
// 파일 코드의 역할/설명: Chat API 요청 검증이 quota 차감 전 잘못된 입력을 차단하는지 확인한다.

import { describe, expect, it } from 'vitest'
import { validateChatRequestBody } from './requestValidation'

describe('validateChatRequestBody', () => {
  it('accepts a valid chat request body', () => {
    const result = validateChatRequestBody({
      messages: [
        { role: 'user', content: '안녕하세요' },
        { role: 'assistant', content: '무엇을 도와드릴까요?' },
        { role: 'user', content: '초안을 검토해주세요.' },
      ],
      model: 'gemini-2.5-flash',
      sessionId: 'session-123',
      projectId: 'project-123',
      coachId: 'coach-123',
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        model: 'gemini-2.5-flash',
        sessionId: 'session-123',
        projectId: 'project-123',
        coachId: 'coach-123',
      },
    })
  })

  it('rejects a missing messages array', () => {
    const result = validateChatRequestBody({})

    expect(result).toMatchObject({
      ok: false,
      error: 'BAD_REQUEST',
      message: 'messages must be a non-empty array.',
    })
  })

  it('rejects an empty latest message before quota is charged', () => {
    const result = validateChatRequestBody({
      messages: [{ role: 'user', content: '   ' }],
    })

    expect(result).toMatchObject({
      ok: false,
      error: 'BAD_REQUEST',
      message: 'The latest message content is required.',
    })
  })

  it('normalizes null and empty optional fields to undefined', () => {
    const result = validateChatRequestBody({
      messages: [{ role: 'user', content: '검토해주세요.' }],
      model: '',
      sessionId: null,
      projectId: '   ',
      coachId: undefined,
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        model: undefined,
        sessionId: undefined,
        projectId: undefined,
        coachId: undefined,
      },
    })
  })

  it('rejects malformed optional identifiers', () => {
    const result = validateChatRequestBody({
      messages: [{ role: 'user', content: '검토해주세요.' }],
      sessionId: 123,
    })

    expect(result).toMatchObject({
      ok: false,
      error: 'BAD_REQUEST',
      message: 'sessionId must be a string when provided.',
    })
  })
})

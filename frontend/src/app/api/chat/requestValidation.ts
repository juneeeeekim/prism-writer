// 디렉토리 경로: frontend/src/app/api/chat/
// 파일명: requestValidation.ts
// 파일 코드의 역할/설명: Chat API 요청 본문을 quota 차감과 LLM 호출 전에 검증한다.

type ChatMessage = {
  role: string
  content: string
}

export type ValidChatRequestBody = {
  messages: ChatMessage[]
  model?: string
  sessionId?: string
  projectId?: string
  coachId?: string
}

type InvalidChatRequest = {
  ok: false
  error: 'BAD_REQUEST'
  message: string
}

type ValidChatRequest = {
  ok: true
  value: ValidChatRequestBody
}

export type ChatRequestValidationResult = ValidChatRequest | InvalidChatRequest

function isInvalidChatRequest(value: ChatMessage[] | InvalidChatRequest): value is InvalidChatRequest {
  return !Array.isArray(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readOptionalString(
  body: Record<string, unknown>,
  field: 'model' | 'sessionId' | 'projectId' | 'coachId'
): string | undefined | InvalidChatRequest {
  const value = body[field]

  if (value == null) return undefined

  if (typeof value !== 'string') {
    return {
      ok: false,
      error: 'BAD_REQUEST',
      message: `${field} must be a string when provided.`,
    }
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function readMessages(value: unknown): ChatMessage[] | InvalidChatRequest {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      ok: false,
      error: 'BAD_REQUEST',
      message: 'messages must be a non-empty array.',
    }
  }

  const messages: ChatMessage[] = []

  for (let index = 0; index < value.length; index++) {
    const item = value[index]

    if (!isRecord(item)) {
      return {
        ok: false,
        error: 'BAD_REQUEST',
        message: `messages[${index}] must be an object.`,
      }
    }

    if (typeof item.role !== 'string' || item.role.trim().length === 0) {
      return {
        ok: false,
        error: 'BAD_REQUEST',
        message: `messages[${index}].role must be a non-empty string.`,
      }
    }

    if (typeof item.content !== 'string') {
      return {
        ok: false,
        error: 'BAD_REQUEST',
        message: `messages[${index}].content must be a string.`,
      }
    }

    messages.push({
      role: item.role,
      content: item.content,
    })
  }

  const lastMessage = messages[messages.length - 1]
  if (!lastMessage.content.trim()) {
    return {
      ok: false,
      error: 'BAD_REQUEST',
      message: 'The latest message content is required.',
    }
  }

  return messages
}

export function validateChatRequestBody(body: unknown): ChatRequestValidationResult {
  if (!isRecord(body)) {
    return {
      ok: false,
      error: 'BAD_REQUEST',
      message: 'Request body must be a JSON object.',
    }
  }

  const messages = readMessages(body.messages)
  if (isInvalidChatRequest(messages)) return messages

  const model = readOptionalString(body, 'model')
  if (typeof model === 'object') return model

  const sessionId = readOptionalString(body, 'sessionId')
  if (typeof sessionId === 'object') return sessionId

  const projectId = readOptionalString(body, 'projectId')
  if (typeof projectId === 'object') return projectId

  const coachId = readOptionalString(body, 'coachId')
  if (typeof coachId === 'object') return coachId

  return {
    ok: true,
    value: {
      messages,
      model,
      sessionId,
      projectId,
      coachId,
    },
  }
}

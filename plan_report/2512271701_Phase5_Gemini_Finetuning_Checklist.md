# 📋 Gemini Finetuning Implementation Checklist (Phase 5)

**작성일**: 2025-12-27
**목표**: `raft_dataset` 데이터를 Gemini 3.0 Flash 파인튜닝용 JSONL 포맷으로 변환 및 추출
**참고 문서**: `2512271625_Gemini_Finetuning_Handover.md`

## 📂 파일 구성 및 선정 근거

**선택**: **단일 파일 구성 (Single File)**
**근거**:

1.  **작업의 연속성**: 데이터 변환 로직(Converter) 구현 → 스크립트 작성 → 실행 및 검증은 끊어지지 않는 하나의 파이프라인입니다. 파일을 분리할 경우 문맥 전환 비용이 발생합니다.
2.  **검증의 편의성**: 변환 로직의 변경 사항이 바로 추출 스크립트의 결과에 영향을 미치므로, 한 문서에서 의존성을 확인하며 진행하는 것이 안전합니다.
3.  **범위의 명확성**: 'Gemini 파인튜닝 지원'이라는 단일 목표에 집중된 작업이므로 하나의 체크리스트로 관리하는 것이 유지보수에 효율적입니다.

---

## ✅ 품질 보증 기준 (Quality Assurance)

모든 작업 항목은 다음 기준을 준수해야 합니다:

- **Coding Style**: TypeScript Strict Mode 준수, ESLint 규칙 위반 없음.
- **Naming**: `convertXToY` 등의 명확한 동사형 함수명 사용.
- **Error Handling**: 데이터 누락(`null/undefined`) 시 기본값 처리 또는 명시적 에러 로깅.
- **Performance**: 대량 데이터(500건+) 처리 시 메모리 누수 방지 (Stream 처리 고려).
- **Accessibility**: CLI/로그 출력의 가독성 확보.

---

## 🚀 Phase 1: Gemini 포맷 변환 로직 구현

**목표**: 기존 OpenAI 포맷 위주의 컨버터를 확장하여 Gemini 호환 포맷을 지원하도록 수정합니다.
**영향받을 수 있는 기존 기능**: `scripts/export_raft_data.ts` (기존 OpenAI용 추출 스크립트) - _수정 시 인터페이스 호환성 주의_

### 1-1. 인터페이스 정의 (Type Definition)

- [ ] **파일**: `frontend/src/lib/raft/types.ts` (없다면 생성 또는 `converter.ts` 상단)
- **위치**: 상단 타입 정의부
- **내용**: Google AI Studio가 요구하는 데이터 구조체 정의
- **연결성**: 이 타입은 이후 `converter.ts` 함수의 반환 타입으로 사용됩니다.

```typescript
interface GeminiPart {
  text: string;
}
interface GeminiMessage {
  role: "user" | "model"; // 'system' 지원 여부 확인 필요 (Flash는 보통 user/model)
  parts: GeminiPart[];
}
interface GeminiTrainingEntry {
  messages: GeminiMessage[];
}
```

### 1-2. 변환 함수 구현 (Converter Implementation)

- [ ] **파일**: `frontend/src/lib/raft/converter.ts`
- **위치**: `convertToRaftFormat` 함수 근처 또는 새로운 함수 추가
- **함수명**: `convertToGeminiFormat(row: RaftRow): GeminiTrainingEntry`
- **내용**:
  - DB `row` 객체(`user_query`, `context`, `gold_answer`)를 입력받음.
  - `user` role 메시지에 `Context`와 `Question`을 조합하여 포맷팅.
  - `model` role 메시지에 `gold_answer` 매핑.
  - **에러 처리**: `context`나 `gold_answer`가 비어있을 경우 `throw Error` 또는 `skip` 처리 로직 포함.

### 🛑 Phase 1 검증 (Verification)

- [ ] **Syntax Check**: `npx tsc --noEmit frontend/src/lib/raft/converter.ts` 오류 없음 확인.
- [ ] **Unit Test (간이)**: 임시 테스트 파일을 만들어 `convertToGeminiFormat`에 더미 데이터를 넣고 `console.log`로 출력해 JSON 구조가 올바른지 확인.

---

## 🚀 Phase 2: JSONL 추출 스크립트 작성

**목표**: DB에서 데이터를 조회하여 Phase 1의 변환기를 통해 JSONL 파일로 저장하는 실행 가능한 스크립트를 작성합니다.
**연결성**: Phase 1에서 만든 `convertToGeminiFormat` 함수를 import하여 사용합니다.

### 2-1. 스크립트 스캐폴딩 (Scaffolding)

- [ ] **파일**: `frontend/scripts/export_gemini_data.ts` (신규 생성)
- **내용**:
  - `dotenv` 설정으로 환경 변수 로드.
  - `supabase-js` 클라이언트 초기화 (`createClient`).
  - DB 연결 에러 처리 (`try-catch`).

### 2-2. 데이터 인출 및 변환 (Fetch & Convert)

- [ ] **파일**: `frontend/scripts/export_gemini_data.ts`
- **위치**: `main` 함수 내부
- **내용**:
  - `supabase.from('raft_dataset').select('*')`로 데이터 조회.
  - 조회된 배열을 순회(.map)하며 Phase 1의 `convertToGeminiFormat` 호출.
  - **성능 고려**: 데이터가 많을 경우 `range`를 사용하여 페이지네이션 처리 검토 (현재 500개이므로 일괄 처리 가능).

### 2-3. 파일 쓰기 (File I/O)

- [ ] **파일**: `frontend/scripts/export_gemini_data.ts`
- **위치**: 변환 루프 이후
- **내용**:
  - 변환된 객체 배열을 한 줄씩 `JSON.stringify` 하여 문자열로 변환.
  - `fs.writeFileSync` 또는 `fs.createWriteStream`을 사용하여 `training_data.jsonl` 파일로 저장.
  - **접근성**: 파일 저장 완료 후 "총 N개의 데이터가 저장되었습니다: [경로]" 로그 출력.

### 🛑 Phase 2 검증 (Verification)

- [ ] **실행 테스트**: `npx ts-node frontend/scripts/export_gemini_data.ts` 실행 시 에러 없이 종료되는지 확인.
- [ ] **파일 생성 확인**: `training_data.jsonl` 파일이 생성되었는지 확인.

---

## 🚀 Phase 3: 최종 결과물 검증 (Execution & Validation)

**목표**: 생성된 데이터가 실제 Google AI Studio 학습에 적합한지 검증합니다.
**연결성**: Phase 2에서 생성된 `training_data.jsonl` 파일을 대상으로 합니다.

### 3-1. JSONL 포맷 유효성 검사

- [ ] **도구**: VS Code 또는 텍스트 에디터
- **확인 항목**:
  - 파일의 각 라인이 유효한 JSON 인가?
  - `messages` 키가 최상위에 존재하는가?
  - `role` 값이 `user`와 `model`로 정확히 매핑되었는가?
  - 특수문자(줄바꿈 등)가 JSON String 이스케이프 처리가 잘 되었는가?

### 3-2. (Option) 샘플 업로드 테스트

- [ ] **작업**: Google AI Studio > Create New > Tuned Model 접속.
- [ ] **수행**: 생성된 파일을 업로드해보고 파싱 에러가 발생하는지 확인. (학습 시작 버튼 누르기 전 단계까지)

### 🛑 Phase 3 검증 (Final Verification)

- [ ] **Checklist Completion**: 위 모든 항목이 체크되었는가?
- [ ] **Ready for Training**: 생성된 파일이 개발자의 로컬 환경에 준비되었는가?

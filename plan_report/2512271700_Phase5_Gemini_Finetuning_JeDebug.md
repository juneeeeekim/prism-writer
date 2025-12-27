# 🛡️ JeDebug Analysis: Gemini Finetuning (Phase 5)

## 1) 🚨 위험 요소 및 디버깅 포인트 (Risk Checklist)

- [ ] (Mid) `converter.ts` 수정에 따른 OpenAI 포맷 하위 호환성 파괴 위험

  - [ ] 원인 분석: 기존 `converter.ts`가 OpenAI 전용으로 작성되어 있을 가능성이 높음
  - [ ] 해결 가이드: 기존 함수(`convertToOpenAI`) 보존, 신규 함수(`convertToGemini`) 추가 방식 적용 (Facade 패턴 고려)
  - [ ] 파일: `frontend/src/lib/raft/converter.ts`
  - [ ] 위치: `export interface RaftConverter` 정의부
  - [ ] 연결성: Phase 1 (변환 로직 구현)
  - [ ] 완료조건: 기존 OpenAI export 스크립트 실행 시 에러 없음 확인

- [ ] (Low) 대량 데이터(Context) 처리에 따른 메모리/JSON 파싱 에러

  - [ ] 원인 분석: `raft_dataset`의 `context` 필드가 매우 클 경우 JSON 변환 중 힙 메모리 부족 가능성
  - [ ] 해결 가이드: Stream 방식 처리 또는 Batch Size(예: 100건) 단위 분할 처리 로직 추가
  - [ ] 파일: `frontend/scripts/export_gemini_data.ts`
  - [ ] 위치: 데이터 Fetch 및 Loop 구간
  - [ ] 연결성: Phase 2 (데이터 추출)
  - [ ] 완료조건: 500건 이상 데이터 처리 시 OOM(Out of Memory) 미발생

- [ ] (Low) 특수문자 이스케이프 처리 누락으로 인한 학습 데이터 파싱 실패
  - [ ] 원인 분석: 사용자 질문/Context 내의 줄바꿈(`\n`), 따옴표(`"`)가 JSONL 포맷을 깨뜨릴 수 있음
  - [ ] 해결 가이드: `JSON.stringify` 활용 및 이중 이스케이프 처리 검증
  - [ ] 파일: `frontend/src/lib/raft/converter.ts`
  - [ ] 위치: 텍스트 매핑 로직
  - [ ] 연결성: Phase 3 (검증)
  - [ ] 완료조건: Google AI Studio 업로드 시 JSON Parse Error 0건

## 2) 🧪 필수 테스트 및 검증 시나리오 (Verification Checklist)

- [ ] Regression Test 케이스 작성

  - [ ] Given: 기존 OpenAI용 Export 스크립트 실행
  - [ ] When: `converter.ts` 파일 수정 후
  - [ ] Then: 기존 `finetuning_data.jsonl` 출력물 구조 동등성 유지
  - [ ] 파일: `frontend/scripts/export_raft_data.ts` (기존 파일)
  - [ ] 완료조건: 스크립트 정상 종료 및 기존 파이프라인 유지

- [ ] Migration Test (Data Integrity) 시나리오 작성

  - [ ] Count 검증: `SELECT COUNT(*) FROM raft_dataset` == `training_data.jsonl` 라인 수
  - [ ] Field 검증: 모든 Row에 `messages` 필드 존재 및 `role: model` 포함 여부 (Sampling 10건)
  - [ ] Content 검증: DB `gold_answer` 데이터가 JSONL `parts.text`에 정확히 매핑되었는지 확인
  - [ ] 완료조건: 데이터 누락 0건 (Log 확인)

- [ ] Load Test 기준 정의
  - [ ] 목표: 500건 데이터 변환 10초 이내 완료
  - [ ] 병목 후보: `JSON.stringify` CPU 점유율, DB Select Latency
  - [ ] 완료조건: 실행 시간 로그 기록 및 허용 범위 내 완료

## 3) 🛑 롤백 및 비상 대응 전략 (Rollback Checklist)

- [ ] Feature Flag 필요성 점검

  - [ ] 플래그 이름: 불필요 (단발성 스크립트 실행 작업임)
  - [ ] 비상 시 대응: 생성된 `training_data.jsonl` 폐기 및 스크립트 실행 중단
  - [ ] 완료조건: 라이브 서비스 영향도 없음 확인

- [ ] 롤백 시나리오 (Code Revert)

  - [ ] 롤백 트리거: `converter.ts` 수정 후 기존 RAG/OpenAI 기능 컴파일 에러 발생 시
  - [ ] 롤백 수행: `git checkout HEAD frontend/src/lib/raft/converter.ts`
  - [ ] 완료조건: 빌드 에러(`npm run build`) 해소

- [ ] 데이터 오염 방지 대책
  - [ ] 롤백 불가 트랜잭션: 해당 없음 (Read-Only 작업)
  - [ ] 완화책: 쓰기 작업(Write) 없음 명시, 오직 파일 생성(Create)만 수행
  - [ ] 완료조건: DB `raft_dataset` 테이블 변경 없음 확인

## 4) 추가 확인 필요사항 (Unknowns Checklist)

- [ ] `raft_dataset` 테이블에 `NULL` 값을 가진 `gold_answer`가 존재하는가? (존재 시 제외/기본값 처리 결정 필요)
- [ ] Gemini Flash 모델의 `system` instruction 지원 여부 (현재 user/model role만 사용하는지 확인)
- [ ] 파인튜닝 데이터의 최소/최대 권장 길이 (Context가 너무 길어 Truncation이 필요한지)
- [ ] Google AI Studio 업로드 파일 용량 제한 확인 (현재 500건 기준 문제없음 예상)

## 5) 최종 의견 (Conclusion Checklist)

- [ ] Confidence 선택: High
- [ ] Go/No-Go 선택: Ready to Build
- [ ] 결정 근거 1: 기존 시스템(DB)에 대한 쓰기 작업이 없어 리스크가 매우 낮음
- [ ] 결정 근거 2: `converter.ts`만 하위 호환성을 지키면 사이드 이펙트 차단 가능
- [ ] 결정 근거 3: 롤백이 단순함 (파일 삭제 또는 Git Revert)
- [ ] 최종 완료조건: `training_data.jsonl` 파일 생성 및 Gemini 포맷 유효성 검증 통과

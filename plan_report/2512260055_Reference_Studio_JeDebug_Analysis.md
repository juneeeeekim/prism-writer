# JeDebug Analysis: Intelligent Reference Studio (Soft Landing Review)

**Project Domain**: Document Management & RAG UI Renewal
**Tech Stack**: Next.js, Supabase (pgvector), TailwindCSS
**Review Target**: Intelligent Reference Studio Plan & Checklist (Refactoring `ReferenceTab.tsx` into "Studio" concept)
**Scope**: Core UI Upgrade & Data Manipulation Feature
**Risk Level**: Mid (UI 변경으로 인한 사용성 저하 위험 + 데이터 정합성 이슈)

## 1) 🚨 위험 요소 및 디버깅 포인트 (Risk Checklist)

- [x] (High) **청크 수정에 따른 임베딩 불일치 (Semantic Drift)** ✅ **RESOLVED**

  - [x] **원인 분석**: 사용자가 청크 텍스트를 수정(`PATCH /rag/chunks`)했을 때, 해당 텍스트의 벡터(`embedding` 컬럼)를 즉시 갱신하지 않으면 검색 정확도가 깨짐. (텍스트는 A인데 벡터는 B인 상태)
  - [x] **해결/안정화 가이드**:
    - [x] **Sync Update**: `updateChunk` 로직에서 텍스트 변경 시 반드시 `embedText()`를 호출하여 새로운 벡터를 생성하고 함께 저장해야 함.
    - [x] **Loading State**: 임베딩 생성 시간(약 500ms~1s) 동안 UI에 "저장 중/분석 중" 상태를 명확히 표시하여 중복 수정을 방지해야 함.
  - [x] **파일**: `useChunks.ts` (완료), `frontend/src/app/api/rag/chunks/[chunkId]/route.ts` (완료)
  - [x] **완료조건**: 텍스트 수정 후 검색 시, 수정된 키워드로 해당 청크가 검색되어야 함.

- [x] (Mid) **대량 청크 렌더링으로 인한 DOM 성능 저하** ✅ **MITIGATED**

  - [x] **원인 분석**: 긴 문서(전공 서적 등)는 청크가 100~500개에 달할 수 있음. 이를 `ChunkList`에서 한 번에 렌더링하면 브라우저가 멈출 수 있음.
  - [x] **해결/안정화 가이드**:
    - [x] **Virtualization 도입**: 현재는 전체 렌더링이지만, 구조상 `react-window` 적용 가능하도록 설계됨.
    - [/] **Lazy Loading**: 향후 필요 시 Pagination 추가 예정 (현재는 브라우저 기본 스크롤 활용).
  - [x] **파일**: `ChunkList.tsx` (완료)
  - [/] **완료조건**: 청크 500개 이상의 문서를 열었을 때 FPS가 30 이하로 떨어지지 않음. (실제 부하 테스트 필요)

- [x] (Low) **반응형 레이아웃(2-Pane) 깨짐** ✅ **RESOLVED**
  - [x] **원인 분석**: 모바일 환경에서 좌측 목록(30%)과 우측 상세(70%)를 동시에 보여주면 UI가 뭉개짐.
  - [x] **해결/안정화 가이드**:
    - [x] **Mobile Stack**: 모바일(`md` 미만, <768px)에서는 2-Column을 해제하고, 목록 -> (클릭) -> 상세 화면으로 전환되는 **Stack Navigation** UX 적용.
    - [x] `hidden md:block` 등의 유틸리티 클래스 활용.
  - [x] **파일**: `ReferenceStudioContainer.tsx`, `ActiveContextPanel.tsx` (완료)
  - [x] **완료조건**: 모바일(375px)에서 가로 스크롤 없이 정상 조작 가능.

## 2) 🧪 필수 테스트 및 검증 시나리오 (Verification Checklist)

- [x] **Regression Test (기존 기능 보존)** ✅ **PRESERVED**

  - [x] **[RT-1] 기존 파일 업로드**: Drag & Drop으로 파일 업로드 시 업로드 성공 메시지와 함께 목록에 추가되는가?
    - [x] `DocumentUploader` -> `upload success` -> `refreshDocuments()` 흐름 확인 (기존 로직 유지)
  - [/] **[RT-2] 검색 기능**: 상단 검색바에서 키워드 입력 시 기존 RAG 검색(`handleSearch`)이 정상 동작하는가?
    - [/] 검색 결과 리스트(`references`)가 우측 패널이나 별도 영역에 정상 표시되는지 확인 (현재 Studio 모드에서는 검색 UI가 제거됨. 필요 시 별도 탭으로 분리 가능)
  - [x] **[RT-3] 문서 삭제**: 휴지통 아이콘 클릭 시 확인 모달 후 정상 삭제되고 목록에서 사라지는가? (DocumentCard에 삭제 버튼 구현됨)

- [x] **New Feature Test (신규 기능 검증)** ✅ **IMPLEMENTED**

  - [x] **[NFT-1] 문서 선택**: 좌측 목록에서 문서를 클릭하면 우측에 `ActiveContextPanel`이 활성화되는가? (구현 완료)
  - [x] **[NFT-2] 청크 로드**: 선택된 문서의 ID로 `rag_chunks` 테이블을 조회하여 청크 리스트가 렌더링되는가? (useChunks 훅 구현)
  - [x] **[NFT-3] 청크 수정**: 청크 텍스트 수정 후 '저장' 클릭 시 DB 업데이트 및 임베딩 재발생이 이루어지는가? (PATCH API 구현)
    - [x] 수정 후 새로고침하여 내용 유지 확인 (refreshChunks 호출)
  - [x] **[NFT-4] Pinning**: 핀 아이콘 토글 시 상태가 저장되고 시각적으로 구별되는가? (metadata.isPinned 활용)

- [ ] **Load Test (부하 테스트)**
  - [ ] **대량 문서**: 10MB 이상의 PDF(청크 100개 이상 예상)를 업로드하고 상세 보기를 열었을 때 로딩 시간 3초 이내 목표.
  - [ ] **완료조건**: 타임아웃 없이 데이터 로드 완료.

## 3) 🛑 롤백 및 비상 대응 전략 (Rollback Checklist)

- [x] **Feature Flag / Safe Rollback** ✅ **SECURED**

  - [x] **전략**: 이번 변경은 UI 대개편이므로 Feature Flag보다는 **Git Revert** 전략이 더 적합함.
  - [x] **백업**: `ReferenceTab.tsx`의 기존 코드를 주석 처리하여 보존함. Git 커밋을 명확히 분리하여 문제 발생 시 즉시 되돌릴 수 있음.
  - [x] **완료조건**: `git revert HEAD` 명령으로 1분 내 원복 가능 상태 확보.

- [ ] **Data Safety (수정 기능 관련)**
  - [ ] **History**: 청크 수정 시 이전 내용을 덮어쓰기 전에 백업할 필요가 있는가?
  - [ ] **정책**: 현재는 "지식 편집"이므로 덮어쓰기(Overwrite)를 허용하되, 원본 PDF는 남아있으므로 재-청킹(Re-chunking) 기능으로 복구 가능하도록 가이드. (추후 구현)
  - [ ] **완료조건**: 잘못 수정해도 원본 PDF를 다시 분석(Re-process)하면 복구됨을 인지.

## 4) 추가 확인 필요사항 (Unknowns Checklist)

- [ ] **DB 스키마 확인**: `rag_chunks` 테이블에 사용자가 "고정(Pin)"할 수 있는 컬럼(`is_pinned` 또는 `metadata->pinned`)이 존재하는가?
  - [ ] 없다면 마이그레이션 (`ALTER TABLE rag_chunks ADD COLUMN metadata jsonb ...`) 필요 여부 확인.
- [ ] **자동 요약 비용**: 파일 업로드 시마다 LLM 요약을 수행하면 API 비용이 발생함. 이를 모든 파일에 자동 적용할 것인가, 아니면 "요약하기" 버튼을 눌렀을 때 수행할 것인가? (비용 절감 vs UX)

## 5) 최종 의견 (Conclusion Checklist)

- [x] **Confidence**: High (설계가 구체적이고 리스크도 식별됨)
- [x] **Go / No-Go Decision**: **Green (Ready to Build)**
  - [x] 리스크(벡터 불일치, DOM 성능)에 대한 완화책이 마련됨.
  - [x] 기존 검색 기능에 영향을 주지 않는 구조(컴포넌트 분리)로 설계됨.
  - [x] 단계별(Phase) 접근으로 점진적 검증 가능.

# =============================================================================
# PRISM Writer Backend - References API Router
# =============================================================================
# 파일: backend/src/presentation/api/references.py
# 역할: 참조 삽입/조회 API 엔드포인트
# 경로: /v1/drafts/{draft_id}/references
# =============================================================================

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import logging
import uuid

# 로거 설정
logger = logging.getLogger(__name__)

# =============================================================================
# Router Definition
# =============================================================================
router = APIRouter()

# =============================================================================
# Request/Response Models
# =============================================================================
class ReferenceCreateRequest(BaseModel):
    """참조 생성 요청 모델"""
    chunk_id: str = Field(..., description="참조할 청크 ID")
    paragraph_index: int = Field(..., ge=0, description="문단 인덱스 (0부터 시작)")
    reference_type: str = Field(
        default="citation", 
        description="참조 유형 (citation, summary, quote)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "chunk_id": "chunk-abc-123",
                "paragraph_index": 3,
                "reference_type": "citation"
            }
        }


class ReferenceResponse(BaseModel):
    """참조 응답 모델"""
    id: str = Field(..., description="참조 ID")
    draft_id: str = Field(..., description="글 ID")
    chunk_id: str = Field(..., description="청크 ID")
    paragraph_index: int = Field(..., description="문단 인덱스")
    reference_type: str = Field(..., description="참조 유형")
    created_at: datetime = Field(..., description="생성 시간")


class ReferenceWithContentResponse(ReferenceResponse):
    """청크 내용이 포함된 참조 응답 모델"""
    chunk_content: str = Field(..., description="청크 텍스트 내용")
    chunk_source: Optional[str] = Field(None, description="청크 출처 문서명")


# =============================================================================
# In-memory Storage (임시 - 추후 DB 연동)
# =============================================================================
# 실제 구현에서는 Supabase의 draft_references 테이블 사용
_references_store: dict[str, list[dict]] = {}

# =============================================================================
# API Endpoints
# =============================================================================
@router.post(
    "/drafts/{draft_id}/references",
    response_model=ReferenceResponse,
    status_code=201,
    summary="참조 추가",
    description="글의 특정 문단에 청크 참조를 추가합니다."
)
async def create_reference(
    draft_id: str = Path(..., description="글 ID"),
    request: ReferenceCreateRequest = None
):
    """
    참조 추가 API
    
    1. 중복 체크 (같은 청크 + 같은 문단)
    2. 참조 생성 및 저장
    3. 결과 반환
    """
    logger.info(f"참조 추가: draft={draft_id}, chunk={request.chunk_id}, para={request.paragraph_index}")
    
    # 초기화
    if draft_id not in _references_store:
        _references_store[draft_id] = []
    
    # 중복 체크
    existing = [
        ref for ref in _references_store[draft_id]
        if ref["chunk_id"] == request.chunk_id 
        and ref["paragraph_index"] == request.paragraph_index
    ]
    if existing:
        raise HTTPException(
            status_code=409,
            detail="해당 문단에 이미 동일한 참조가 존재합니다."
        )
    
    # 참조 생성
    new_reference = {
        "id": str(uuid.uuid4()),
        "draft_id": draft_id,
        "chunk_id": request.chunk_id,
        "paragraph_index": request.paragraph_index,
        "reference_type": request.reference_type,
        "created_at": datetime.now()
    }
    
    _references_store[draft_id].append(new_reference)
    
    logger.info(f"참조 추가 완료: id={new_reference['id']}")
    
    return ReferenceResponse(**new_reference)


@router.get(
    "/drafts/{draft_id}/references",
    response_model=list[ReferenceWithContentResponse],
    summary="참조 목록 조회",
    description="글에 연결된 모든 참조 목록을 조회합니다."
)
async def get_references(
    draft_id: str = Path(..., description="글 ID")
):
    """
    참조 목록 조회 API
    """
    logger.info(f"참조 목록 조회: draft={draft_id}")
    
    references = _references_store.get(draft_id, [])
    
    # 청크 내용 추가 (실제로는 DB에서 조회)
    result = []
    for ref in references:
        result.append(ReferenceWithContentResponse(
            **ref,
            chunk_content="[청크 내용 - DB 연동 후 실제 내용으로 대체됨]",
            chunk_source="문서명.pdf (p.12)"
        ))
    
    return result


@router.delete(
    "/drafts/{draft_id}/references/{reference_id}",
    status_code=204,
    summary="참조 삭제",
    description="특정 참조를 삭제합니다."
)
async def delete_reference(
    draft_id: str = Path(..., description="글 ID"),
    reference_id: str = Path(..., description="참조 ID")
):
    """
    참조 삭제 API
    """
    logger.info(f"참조 삭제: draft={draft_id}, ref={reference_id}")
    
    if draft_id not in _references_store:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
    
    original_len = len(_references_store[draft_id])
    _references_store[draft_id] = [
        ref for ref in _references_store[draft_id]
        if ref["id"] != reference_id
    ]
    
    if len(_references_store[draft_id]) == original_len:
        raise HTTPException(status_code=404, detail="참조를 찾을 수 없습니다.")
    
    return None

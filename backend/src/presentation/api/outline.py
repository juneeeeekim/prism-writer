# =============================================================================
# PRISM Writer Backend - Outline API Router
# =============================================================================
# 파일: backend/src/presentation/api/outline.py
# 역할: 목차 생성 API 엔드포인트
# 경로: POST /v1/outline/generate
# =============================================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import logging

# 로거 설정
logger = logging.getLogger(__name__)

# =============================================================================
# Router Definition
# =============================================================================
router = APIRouter()

# =============================================================================
# Request/Response Models
# =============================================================================
class OutlineGenerateRequest(BaseModel):
    """목차 생성 요청 모델"""
    topic: str = Field(..., min_length=1, max_length=500, description="글의 주제")
    document_ids: list[str] = Field(default=[], description="참조할 문서 ID 리스트")
    max_depth: int = Field(default=3, ge=1, le=5, description="목차 최대 깊이")
    
    class Config:
        json_schema_extra = {
            "example": {
                "topic": "AI 시대의 글쓰기 방법론",
                "document_ids": ["doc-123", "doc-456"],
                "max_depth": 3
            }
        }


class OutlineItem(BaseModel):
    """개별 목차 항목"""
    title: str = Field(..., description="목차 제목")
    depth: int = Field(..., ge=1, le=5, description="목차 깊이 (1=H1, 2=H2, ...)")


class OutlineGenerateResponse(BaseModel):
    """목차 생성 응답 모델"""
    outline: list[OutlineItem] = Field(..., description="생성된 목차 리스트")
    topic: str = Field(..., description="입력된 주제")
    sources_used: int = Field(default=0, description="참조된 문서 수")


# =============================================================================
# API Endpoints
# =============================================================================
@router.post(
    "/generate",
    response_model=OutlineGenerateResponse,
    summary="목차 생성",
    description="주제와 참조 문서를 기반으로 AI가 목차를 생성합니다."
)
async def generate_outline(request: OutlineGenerateRequest):
    """
    목차 생성 API 엔드포인트
    
    1. 입력 주제 검증
    2. (선택) 참조 문서에서 구조 정보 검색
    3. LLM을 통한 목차 생성
    4. 결과 반환
    """
    try:
        logger.info(f"목차 생성 요청: topic='{request.topic}', docs={len(request.document_ids)}")
        
        # ---------------------------------------------------------------------
        # TODO: 실제 RAG + LLM 연동 (Phase 3에서 구현)
        # 현재는 더미 데이터 반환
        # ---------------------------------------------------------------------
        
        # 더미 목차 생성 (주제 기반)
        dummy_outline = [
            OutlineItem(title="서론", depth=1),
            OutlineItem(title="배경 및 목적", depth=2),
            OutlineItem(title="연구 범위", depth=2),
            OutlineItem(title="본론", depth=1),
            OutlineItem(title=f"{request.topic}의 핵심 개념", depth=2),
            OutlineItem(title="주요 방법론", depth=2),
            OutlineItem(title="사례 분석", depth=2),
            OutlineItem(title="결론", depth=1),
            OutlineItem(title="요약", depth=2),
            OutlineItem(title="향후 전망", depth=2),
        ]
        
        # max_depth 필터링
        filtered_outline = [
            item for item in dummy_outline 
            if item.depth <= request.max_depth
        ]
        
        logger.info(f"목차 생성 완료: {len(filtered_outline)}개 항목")
        
        return OutlineGenerateResponse(
            outline=filtered_outline,
            topic=request.topic,
            sources_used=len(request.document_ids)
        )
        
    except Exception as e:
        logger.error(f"목차 생성 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"목차 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.get(
    "/templates",
    summary="목차 템플릿 목록",
    description="사전 정의된 목차 템플릿 목록을 반환합니다."
)
async def get_outline_templates():
    """
    목차 템플릿 목록 조회
    """
    templates = [
        {
            "id": "academic",
            "name": "학술 논문",
            "outline": [
                {"title": "서론", "depth": 1},
                {"title": "문헌 검토", "depth": 1},
                {"title": "연구 방법", "depth": 1},
                {"title": "결과", "depth": 1},
                {"title": "논의", "depth": 1},
                {"title": "결론", "depth": 1},
            ]
        },
        {
            "id": "blog",
            "name": "블로그 포스트",
            "outline": [
                {"title": "도입부", "depth": 1},
                {"title": "핵심 내용", "depth": 1},
                {"title": "예시/사례", "depth": 2},
                {"title": "마무리", "depth": 1},
            ]
        },
        {
            "id": "report",
            "name": "보고서",
            "outline": [
                {"title": "개요", "depth": 1},
                {"title": "현황 분석", "depth": 1},
                {"title": "문제점 및 과제", "depth": 1},
                {"title": "해결 방안", "depth": 1},
                {"title": "기대 효과", "depth": 1},
                {"title": "결론", "depth": 1},
            ]
        },
    ]
    
    return {"templates": templates}

# =============================================================================
# PRISM Writer Backend - Presentation Layer API Init
# =============================================================================
# 파일: backend/src/presentation/api/__init__.py
# 역할: API 라우터 aggregation
# =============================================================================

from fastapi import APIRouter

# 개별 라우터 import
from .outline import router as outline_router
from .references import router as references_router

# =============================================================================
# Main API Router
# =============================================================================
api_router = APIRouter()

# 라우터 등록
api_router.include_router(outline_router, prefix="/outline", tags=["Outline"])
api_router.include_router(references_router, tags=["References"])

# 향후 추가될 라우터들
# api_router.include_router(documents_router, prefix="/documents", tags=["Documents"])
# api_router.include_router(drafts_router, prefix="/drafts", tags=["Drafts"])


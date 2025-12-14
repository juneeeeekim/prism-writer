# =============================================================================
# PRISM Writer Backend - Retriever (RAG 검색)
# =============================================================================
# 파일: backend/src/infrastructure/retriever.py
# 역할: 벡터 DB에서 관련 청크 검색
# =============================================================================

from typing import Optional
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# Retriever Class
# =============================================================================
class ChunkRetriever:
    """
    벡터 DB에서 관련 청크를 검색하는 클래스
    """
    
    def __init__(self, supabase_client=None):
        """
        Args:
            supabase_client: Supabase 클라이언트 (의존성 주입)
        """
        self.client = supabase_client
    
    async def retrieve_chunks(
        self,
        query: str,
        user_id: Optional[str] = None,
        doc_ids: Optional[list[str]] = None,
        top_k: int = 10,
        threshold: float = 0.7
    ) -> list[dict]:
        """
        쿼리와 유사한 청크 검색
        
        Args:
            query: 검색 쿼리 (자연어)
            user_id: 사용자 ID (RLS 필터링)
            doc_ids: 특정 문서 ID 리스트로 필터링
            top_k: 반환할 최대 결과 수
            threshold: 유사도 임계값 (0.0 ~ 1.0)
            
        Returns:
            검색된 청크 리스트 [{"id", "content", "metadata", "similarity"}]
        """
        logger.info(f"청크 검색: query='{query[:50]}...', top_k={top_k}")
        
        # TODO: 실제 벡터 검색 구현
        # 1. 쿼리를 임베딩 벡터로 변환
        # 2. Supabase의 match_documents RPC 호출
        # 3. 결과 반환
        
        # 현재는 더미 데이터 반환
        return []
    
    async def retrieve_structure_chunks(
        self,
        topic: str,
        doc_ids: Optional[list[str]] = None,
        top_k: int = 50
    ) -> list[dict]:
        """
        헤더 기반 구조적 청크 검색 (목차 생성용)
        
        Args:
            topic: 주제
            doc_ids: 참조할 문서 ID 리스트
            top_k: 최대 검색 수
            
        Returns:
            헤더 메타데이터가 있는 청크 리스트
        """
        logger.info(f"구조적 청크 검색: topic='{topic}'")
        
        # 1. 일반 검색 수행
        all_chunks = await self.retrieve_chunks(
            query=topic,
            doc_ids=doc_ids,
            top_k=top_k,
            threshold=0.5  # 구조 검색은 임계값 낮춤
        )
        
        # 2. 헤더 메타데이터가 있는 것만 필터링
        structure_chunks = [
            chunk for chunk in all_chunks
            if chunk.get("metadata", {}).get("header_level") is not None
        ]
        
        logger.info(f"구조적 청크 {len(structure_chunks)}개 발견")
        return structure_chunks

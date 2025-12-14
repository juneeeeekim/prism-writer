# =============================================================================
# PRISM Writer Backend - Generate Outline Use Case
# =============================================================================
# 파일: backend/src/application/use_cases/generate_outline.py
# 역할: 목차 생성 비즈니스 로직 (RAG + LLM)
# =============================================================================

from typing import Optional
import json
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# Data Classes
# =============================================================================
class OutlineItem:
    """목차 항목"""
    def __init__(self, title: str, depth: int):
        self.title = title
        self.depth = depth
    
    def to_dict(self) -> dict:
        return {"title": self.title, "depth": self.depth}


# =============================================================================
# Use Case
# =============================================================================
class GenerateOutlineUseCase:
    """
    목차 생성 유스케이스
    
    1. 참조 문서에서 구조 정보 검색 (RAG)
    2. LLM을 통한 목차 생성
    3. JSON 파싱 및 검증
    """
    
    def __init__(self, retriever=None, llm_client=None):
        """
        Args:
            retriever: ChunkRetriever 인스턴스
            llm_client: LLM 클라이언트 (OpenAI 등)
        """
        self.retriever = retriever
        self.llm_client = llm_client
        self.max_retries = 2
    
    async def execute(
        self,
        topic: str,
        doc_ids: Optional[list[str]] = None,
        max_depth: int = 3
    ) -> list[OutlineItem]:
        """
        목차 생성 실행
        
        Args:
            topic: 글 주제
            doc_ids: 참조할 문서 ID 리스트
            max_depth: 최대 목차 깊이
            
        Returns:
            OutlineItem 리스트
        """
        logger.info(f"목차 생성 시작: topic='{topic}'")
        
        # ---------------------------------------------------------------------
        # Step 1: 참조 문서에서 구조 검색
        # ---------------------------------------------------------------------
        context = ""
        if self.retriever and doc_ids:
            structure_chunks = await self.retriever.retrieve_structure_chunks(
                topic=topic,
                doc_ids=doc_ids
            )
            context = self._format_chunks_for_prompt(structure_chunks)
        
        # ---------------------------------------------------------------------
        # Step 2: LLM 호출로 목차 생성
        # ---------------------------------------------------------------------
        if self.llm_client:
            outline_json = await self._generate_with_llm(
                topic=topic,
                context=context,
                max_depth=max_depth
            )
            outline_items = self._parse_outline_json(outline_json)
        else:
            # LLM 없으면 기본 목차 반환
            outline_items = self._get_default_outline(topic, max_depth)
        
        logger.info(f"목차 생성 완료: {len(outline_items)}개 항목")
        return outline_items
    
    def _format_chunks_for_prompt(self, chunks: list[dict]) -> str:
        """청크 리스트를 프롬프트용 문자열로 변환"""
        if not chunks:
            return "참고 자료 없음"
        
        formatted = []
        for i, chunk in enumerate(chunks[:10], 1):  # 최대 10개
            header = chunk.get("metadata", {}).get("header", "")
            content = chunk.get("content", "")[:200]  # 200자 제한
            formatted.append(f"{i}. {header}: {content}...")
        
        return "\n".join(formatted)
    
    async def _generate_with_llm(
        self,
        topic: str,
        context: str,
        max_depth: int
    ) -> str:
        """LLM을 통한 목차 생성 (재시도 포함)"""
        from src.infrastructure.prompts.outline_prompt import OUTLINE_GENERATION_PROMPT
        
        prompt = OUTLINE_GENERATION_PROMPT.format(
            topic=topic,
            context=context or "참고 자료 없음",
            max_depth=max_depth
        )
        
        for attempt in range(self.max_retries + 1):
            try:
                # TODO: 실제 LLM 호출 구현
                # response = await self.llm_client.chat.completions.create(...)
                # return response.choices[0].message.content
                
                # 현재는 기본 JSON 반환
                return self._get_default_outline_json(topic)
                
            except Exception as e:
                logger.warning(f"LLM 호출 실패 (시도 {attempt + 1}): {e}")
                if attempt == self.max_retries:
                    raise
        
        return "[]"
    
    def _parse_outline_json(self, json_str: str) -> list[OutlineItem]:
        """JSON 문자열을 OutlineItem 리스트로 파싱"""
        try:
            # JSON 배열 추출 (마크다운 코드블록 제거)
            clean_json = json_str.strip()
            if "```" in clean_json:
                clean_json = clean_json.split("```")[1]
                if clean_json.startswith("json"):
                    clean_json = clean_json[4:]
            
            data = json.loads(clean_json)
            
            return [
                OutlineItem(title=item["title"], depth=item["depth"])
                for item in data
                if isinstance(item, dict) and "title" in item and "depth" in item
            ]
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON 파싱 실패: {e}")
            return []
    
    def _get_default_outline(self, topic: str, max_depth: int) -> list[OutlineItem]:
        """기본 목차 반환 (LLM 없을 때)"""
        items = [
            OutlineItem("서론", 1),
            OutlineItem("배경 및 목적", 2),
            OutlineItem("본론", 1),
            OutlineItem(f"{topic}의 핵심 개념", 2),
            OutlineItem("주요 방법론", 2),
            OutlineItem("결론", 1),
            OutlineItem("요약 및 제언", 2),
        ]
        return [item for item in items if item.depth <= max_depth]
    
    def _get_default_outline_json(self, topic: str) -> str:
        """기본 목차 JSON 반환"""
        return json.dumps([
            {"title": "서론", "depth": 1},
            {"title": "배경 및 목적", "depth": 2},
            {"title": "본론", "depth": 1},
            {"title": f"{topic}의 핵심 개념", "depth": 2},
            {"title": "주요 방법론", "depth": 2},
            {"title": "결론", "depth": 1},
            {"title": "요약 및 제언", "depth": 2},
        ], ensure_ascii=False)

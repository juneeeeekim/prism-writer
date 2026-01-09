// =============================================================================
// PRISM Writer - Outline Map Component (React Flow)
// =============================================================================
// 파일: frontend/src/components/structure/OutlineMap.tsx
// 역할: 구조 분석 결과를 마인드맵/플로우차트 형태로 시각화
// 기능: 노드 드래그로 문서 순서 변경
// 참고: [Structure Map Enhancement P1-01, P1-02]
// =============================================================================

'use client'

import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  type NodeDragHandler,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'

import type { StructureSuggestion, OrderSuggestion, DocumentSummary } from '@/lib/rag/structureHelpers'

// =============================================================================
// Types
// =============================================================================

interface OutlineMapProps {
  /** 구조 분석 결과 */
  suggestion: StructureSuggestion | null
  /** 순서 변경 콜백 */
  onOrderChange: (newOrder: string[]) => void
  /** 읽기 전용 모드 */
  readOnly?: boolean
  /** [P1-02] 문서 목록 (제목 조회용) */
  documents: DocumentSummary[]
}

/** 노드 데이터 타입 */
interface NodeData {
  docId: string
  label: string // Fallback or short label
  title: string // Full document title
  tag: string
  reason: string
  index: number
}

// =============================================================================
// Constants
// =============================================================================

/** 노드 간 수평 간격 */
const NODE_GAP_X = 220 // Custom Node 너비 고려하여 증가

/** 노드 시작 Y 위치 */
const NODE_START_Y = 100

/** 태그별 색상 */
const TAG_COLORS: Record<string, string> = {
  '서론': '#10b981', // green-500
  '본론': '#3b82f6', // blue-500
  '결론': '#8b5cf6', // violet-500
  '도입': '#10b981',
  '전개': '#3b82f6',
  '마무리': '#8b5cf6',
  default: '#6b7280', // gray-500
}

// =============================================================================
// [P1-01] Custom Node Component
// =============================================================================

const CustomNode = ({ data }: { data: NodeData }) => {
  return (
    <div className="flex flex-col w-[180px] bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all hover:shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      
      {/* Header: Tag */}
      <div 
        className="px-3 py-1.5 text-white font-bold text-sm text-center"
        style={{ backgroundColor: TAG_COLORS[data.tag] || TAG_COLORS.default }}
      >
        {data.tag}
      </div>
      
      {/* Body: Title */}
      <div className="p-3 text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 text-center break-words leading-tight flex items-center justify-center min-h-[50px]">
        {data.title || data.label || '제목 없음'}
      </div>
      
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  )
}

// =============================================================================
// Helper: 노드 변환
// =============================================================================

/**
 * OrderSuggestion 배열을 React Flow 노드로 변환
 * [P1-02] documents 인자 추가하여 제목 조회
 */
function convertToNodes(
  orders: OrderSuggestion[], 
  documents: DocumentSummary[]
): Node<NodeData>[] {
  if (!orders || orders.length === 0) return []

  return orders.map((order, index) => {
    // 문서 제목 찾기
    const doc = documents.find(d => d.id === order.docId)
    const title = doc?.title || '제목 없음'

    return {
      id: order.docId,
      type: 'custom', // [P1-01] Use Custom Node
      position: {
        x: index * NODE_GAP_X + 50,
        y: NODE_START_Y,
      },
      data: {
        docId: order.docId,
        label: order.assignedTag || `문서 ${index + 1}`,
        title, // [P1-02] Inject Title
        tag: order.assignedTag,
        reason: order.reason,
        index,
      },
      draggable: true,
    }
  })
}

/**
 * 노드 배열에서 엣지 생성 (순서대로 연결)
 */
function generateEdges(nodes: Node<NodeData>[]): Edge[] {
  if (nodes.length < 2) return []

  // 노드를 x 좌표로 정렬
  const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x)

  return sortedNodes.slice(0, -1).map((node, index) => ({
    id: `e-${node.id}-${sortedNodes[index + 1].id}`,
    source: node.id,
    target: sortedNodes[index + 1].id,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#9ca3af', strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#9ca3af',
    },
  }))
}

// =============================================================================
// Main Component: OutlineMap
// =============================================================================

export default function OutlineMap({
  suggestion,
  onOrderChange,
  readOnly = false,
  documents, // [P1-02] Receive valid documents
}: OutlineMapProps) {
  
  // [P1-02] Define Node Types (Memoized)
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), [])

  // ---------------------------------------------------------------------------
  // 노드 및 엣지 초기화
  // ---------------------------------------------------------------------------
  const initialNodes = useMemo(
    () => convertToNodes(suggestion?.suggestedOrder || [], documents),
    [suggestion, documents]
  )

  const initialEdges = useMemo(
    () => generateEdges(initialNodes),
    [initialNodes]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // ---------------------------------------------------------------------------
  // 노드 드래그 종료 핸들러
  // ---------------------------------------------------------------------------
  const onNodeDragStop: NodeDragHandler = useCallback(
    (event, node) => {
      // 읽기 전용 모드에서는 순서 변경 안 함
      if (readOnly) return

      // 노드가 1개 이하면 순서 변경 의미 없음
      if (nodes.length <= 1) return

      // X 좌표 기준으로 노드 정렬
      const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x)

      // docId 배열 추출
      const newOrder = sortedNodes.map((n) => n.data.docId)

      // 엣지 재생성 (새 순서 반영)
      const newEdges = generateEdges(sortedNodes)
      setEdges(newEdges)

      // 콜백 호출
      onOrderChange(newOrder)

      console.log('[OutlineMap] 순서 변경:', newOrder)
    },
    [nodes, readOnly, onOrderChange, setEdges]
  )

  // ---------------------------------------------------------------------------
  // Suggestion이 null이면 빈 상태 표시
  // ---------------------------------------------------------------------------
  if (!suggestion || !suggestion.suggestedOrder || suggestion.suggestedOrder.length === 0) {
    return (
      <div className="outline-map-empty flex items-center justify-center h-[300px] 
                      bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed 
                      border-gray-300 dark:border-gray-600">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">📊</div>
          <div className="font-medium">분석 결과 없음</div>
          <div className="text-sm">AI 분석을 실행하면 구조 맵이 표시됩니다</div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="outline-map-container h-[400px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes} // [P1-02] Use Custom Node Types
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
        maxZoom={1.5}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable={!readOnly}
        panOnDrag={true}
        zoomOnScroll={true}
        attributionPosition="bottom-left"
      >
        {/* 컨트롤 패널 (줌 인/아웃, 피팅) */}
        <Controls showInteractive={false} />

        {/* 배경 그리드 */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#aaafb5" // 조금 더 진하게
        />
      </ReactFlow>

      {/* 안내 메시지 */}
      {!readOnly && nodes.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 
                        bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
          💡 노드를 드래그하여 순서를 변경하세요
        </div>
      )}
    </div>
  )
}

export { OutlineMap }

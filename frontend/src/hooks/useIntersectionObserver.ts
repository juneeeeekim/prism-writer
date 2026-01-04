// =============================================================================
// PRISM Writer - Intersection Observer Hook (P-B03-01)
// =============================================================================
// 파일: frontend/src/hooks/useIntersectionObserver.ts
// 역할: 무한 스크롤 및 요소 가시성 감지를 위한 Intersection Observer 훅
// 작성일: 2026-01-04
// Phase: B - UX 개선
// =============================================================================

'use client'

import { useRef, useEffect, useCallback } from 'react'

// =============================================================================
// [P-B03-01] 타입 정의
// =============================================================================

/**
 * useIntersectionObserver 훅 옵션
 *
 * @description
 * IntersectionObserverInit을 확장하여 추가 옵션 제공
 */
export interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  /**
   * 콜백 실행 후 옵저버 해제 여부
   * true: 한 번 실행 후 더 이상 감지하지 않음
   * false: 계속 감지 (기본값)
   */
  once?: boolean

  /**
   * 옵저버 활성화 여부
   * false로 설정하면 옵저버가 동작하지 않음
   * 조건부 무한 스크롤에 유용 (예: 더 이상 로드할 데이터가 없을 때)
   */
  enabled?: boolean
}

/**
 * useIntersectionObserver 훅 반환 타입
 */
export interface UseIntersectionObserverReturn<T extends HTMLElement = HTMLDivElement> {
  /** 관찰 대상 요소에 연결할 ref */
  ref: React.RefObject<T>

  /** 현재 요소가 화면에 보이는지 여부 */
  isIntersecting: boolean
}

// =============================================================================
// [P-B03-01] useIntersectionObserver 훅
// =============================================================================

/**
 * Intersection Observer를 활용한 요소 가시성 감지 훅
 *
 * @description
 * 무한 스크롤, 레이지 로딩, 요소 가시성 추적 등에 활용할 수 있습니다.
 * - 요소가 뷰포트에 진입하면 콜백 실행
 * - threshold, rootMargin 등 옵션 커스터마이징 가능
 * - once 옵션으로 일회성 실행 지원
 * - enabled 옵션으로 조건부 활성화 지원
 *
 * @param callback - 요소가 화면에 보일 때 실행할 콜백 함수
 * @param options - IntersectionObserver 옵션 + 확장 옵션
 * @returns ref (관찰 대상에 연결)
 *
 * @example
 * ```tsx
 * // 무한 스크롤 예시
 * function InfiniteList() {
 *   const [items, setItems] = useState([])
 *   const [hasMore, setHasMore] = useState(true)
 *
 *   const loadMore = useCallback(() => {
 *     fetchMoreItems().then(newItems => {
 *       setItems(prev => [...prev, ...newItems])
 *       if (newItems.length === 0) setHasMore(false)
 *     })
 *   }, [])
 *
 *   const { ref } = useIntersectionObserver(loadMore, {
 *     threshold: 0.1,
 *     enabled: hasMore,  // 더 이상 데이터가 없으면 비활성화
 *   })
 *
 *   return (
 *     <div>
 *       {items.map(item => <Item key={item.id} {...item} />)}
 *       {hasMore && <div ref={ref}>Loading...</div>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLDivElement>(
  callback: () => void,
  options?: UseIntersectionObserverOptions
): UseIntersectionObserverReturn<T> {
  // ---------------------------------------------------------------------------
  // [P-B03-01] Refs 및 상태
  // ---------------------------------------------------------------------------
  const ref = useRef<T>(null)

  // ---------------------------------------------------------------------------
  // [P-B03-01] 옵션 분리 (확장 옵션 vs IntersectionObserver 옵션)
  // ---------------------------------------------------------------------------
  const {
    once = false,
    enabled = true,
    threshold = 0.1,
    root = null,
    rootMargin = '0px',
  } = options || {}

  // ---------------------------------------------------------------------------
  // [P-B03-01] 콜백 메모이제이션
  // 콜백이 변경되어도 옵저버를 재생성하지 않도록 최신 콜백 참조 유지
  // ---------------------------------------------------------------------------
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // ---------------------------------------------------------------------------
  // [P-B03-01] Intersection Observer 설정
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 비활성화 상태면 옵저버 생성하지 않음
    if (!enabled) return

    // ref.current가 null인 경우 안전하게 처리
    const element = ref.current
    if (!element) return

    // =========================================================================
    // IntersectionObserver 생성
    // - threshold: 요소가 얼마나 보여야 콜백을 실행할지 (0.1 = 10%)
    // - rootMargin: 루트 요소의 마진 (미리 로드하려면 양수 값 사용)
    // =========================================================================
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries

        if (entry.isIntersecting) {
          // 콜백 실행
          callbackRef.current()

          // once 옵션이 true면 한 번 실행 후 옵저버 해제
          if (once) {
            observer.disconnect()
          }
        }
      },
      {
        threshold,
        root,
        rootMargin,
      }
    )

    // 요소 관찰 시작
    observer.observe(element)

    // =========================================================================
    // 클린업: 컴포넌트 언마운트 또는 의존성 변경 시 옵저버 해제
    // =========================================================================
    return () => {
      observer.disconnect()
    }
  }, [enabled, once, threshold, root, rootMargin])

  // ---------------------------------------------------------------------------
  // [P-B03-01] 반환
  // ---------------------------------------------------------------------------
  return {
    ref,
    isIntersecting: false, // 현재는 콜백 기반으로만 동작
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default useIntersectionObserver

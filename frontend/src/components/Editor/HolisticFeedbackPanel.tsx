"use client";

// =============================================================================
// PRISM Writer - Holistic Feedback Panel
// =============================================================================
// 파일: frontend/src/components/Editor/HolisticFeedbackPanel.tsx
// 역할: 전체 글에 대한 종합 평가 표시 (A + B + C)
// 작성일: 2025-12-28
// =============================================================================
// [P2-05] 종합 평가 UI 컴포넌트
// - 섹션 A: 종합 피드백 (한 문단)
// - 섹션 B: 영역별 조언 (아코디언)
// - 섹션 C: 점수 바 + 액션 아이템
// =============================================================================

import { useState, memo } from "react";
import { clsx } from "clsx";
import { type HolisticEvaluationResult } from "@/lib/judge/types";

// =============================================================================
// Props 타입 정의
// =============================================================================

interface HolisticFeedbackPanelProps {
  /** 종합 평가 결과 */
  result?: HolisticEvaluationResult | null;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** [P4] 재평가 핸들러 */
  onRetry?: () => void;
}

// =============================================================================
// 로딩 스켈레톤 컴포넌트
// =============================================================================

function LoadingSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4 p-4"
      aria-label="종합 평가 로딩 중"
      role="status"
    >
      {/* 섹션 A 스켈레톤 */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>

      {/* 섹션 B 스켈레톤 */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>

      {/* 섹션 C 스켈레톤 */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  );
}

// =============================================================================
// 점수 바 컴포넌트
// =============================================================================

interface ScoreBarProps {
  label: string;
  score: number;
  color: string;
}

const ScoreBar = memo(function ScoreBar({
  label,
  score,
  color,
}: ScoreBarProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "bg-green-500";
    if (s >= 60) return "bg-yellow-500";
    if (s >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 dark:text-gray-400 w-12">
        {label}
      </span>
      <div
        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} 점수: ${score}점`}
      >
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-500",
            getScoreColor(score)
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">
        {score}
      </span>
    </div>
  );
});

// =============================================================================
// 영역별 조언 아코디언 컴포넌트
// =============================================================================

interface AdviceAccordionProps {
  title: string;
  icon: string;
  content: string;
  defaultOpen?: boolean;
}

const AdviceAccordion = memo(function AdviceAccordion({
  title,
  icon,
  content,
  defaultOpen = false,
}: AdviceAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full px-3 py-2 flex items-center justify-between text-left",
          "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
        )}
        aria-expanded={isOpen}
        aria-label={`${title} 조언 ${isOpen ? "접기" : "펼치기"}`}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <span>{icon}</span>
          {title}
        </span>
        <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          {content}
        </div>
      )}
    </div>
  );
});

// =============================================================================
// 메인 컴포넌트: HolisticFeedbackPanel
// =============================================================================

export default function HolisticFeedbackPanel({
  result,
  isLoading = false,
  onRetry,
}: HolisticFeedbackPanelProps) {
  // ---------------------------------------------------------------------------
  // 로딩 상태
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // ---------------------------------------------------------------------------
  // 결과 없음 상태
  // ---------------------------------------------------------------------------
  if (!result) {
    return (
      <div
        className="flex flex-col items-center justify-center p-6 text-center"
        role="status"
        aria-label="종합 평가 결과 없음"
      >
        <div className="text-4xl mb-3 opacity-50">📊</div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          종합 평가 결과가 없습니다
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          평가를 요청하면 전체 글에 대한 종합 피드백을 받을 수 있습니다.
        </p>
      </div>
    );
  }

  const { summaryA, adviceB, scoreC } = result;

  // ---------------------------------------------------------------------------
  // 종합 점수 색상 결정
  // ---------------------------------------------------------------------------
  const getOverallScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div
      className="space-y-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 relative"
      role="region"
      aria-label="종합 평가 결과"
    >
      {/* [P4] 재평가 버튼 (상단 우측) - UX 개선: 로딩 시 시각적 피드백 강화 */}
      {onRetry && (
        <div className="absolute top-4 right-4">
          <button
            onClick={onRetry}
            disabled={isLoading}
            className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${
              isLoading
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 cursor-wait'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
            } disabled:cursor-not-allowed`}
            title="다시 평가하기"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span className="animate-pulse">평가 중...</span>
              </>
            ) : (
              <>
                <span>🔄</span> 재평가
              </>
            )}
          </button>
        </div>
      )}
      {/* ===================================================================== */}
      {/* 섹션 A: 종합 피드백 (한 문단) */}
      {/* ===================================================================== */}
      <section aria-labelledby="summary-heading">
        <h3
          id="summary-heading"
          className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1"
        >
          <span>📝</span> 종합 피드백
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
          {summaryA.overview}
        </p>
      </section>

      {/* ===================================================================== */}
      {/* 섹션 B: 영역별 조언 (아코디언) */}
      {/* ===================================================================== */}
      <section aria-labelledby="advice-heading">
        <h3
          id="advice-heading"
          className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1"
        >
          <span>💡</span> 영역별 조언
        </h3>
        <div className="space-y-2">
          <AdviceAccordion
            title="구조"
            icon="📐"
            content={adviceB.structure}
            defaultOpen={true}
          />
          <AdviceAccordion title="내용" icon="📖" content={adviceB.content} />
          <AdviceAccordion
            title="표현"
            icon="✨"
            content={adviceB.expression}
          />
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 섹션 C: 점수 바 + 액션 아이템 */}
      {/* ===================================================================== */}
      <section aria-labelledby="score-heading">
        <h3
          id="score-heading"
          className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1"
        >
          <span>📊</span> 점수 & 개선 항목
        </h3>

        {/* 종합 점수 */}
        <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            종합 점수
          </span>
          <span
            className={clsx(
              "text-3xl font-bold",
              getOverallScoreColor(scoreC.overall)
            )}
            aria-label={`종합 점수 ${scoreC.overall}점`}
          >
            {scoreC.overall}
          </span>
          <span className="text-sm text-gray-400">/100</span>

          {/* [P4] 0점 에러 상황 대응 */}
          {scoreC.overall === 0 && (
            <div className="ml-auto text-xs text-red-500 flex items-center gap-1">
              <span>⚠️ 평가 오류 발생</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="underline hover:text-red-600 font-medium"
                >
                  다시 시도
                </button>
              )}
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 영역별 점수 바 */}
        {/* [H-04] Core 루브릭 점수(trust, persuasion) 추가 */}
        {/* ===================================================================== */}
        <div className="space-y-2 mb-4">
          <ScoreBar
            label="구조"
            score={scoreC.breakdown.structure}
            color="blue"
          />
          <ScoreBar
            label="내용"
            score={scoreC.breakdown.content}
            color="green"
          />
          <ScoreBar
            label="표현"
            score={scoreC.breakdown.expression}
            color="purple"
          />
          <ScoreBar
            label="논리"
            score={scoreC.breakdown.logic}
            color="orange"
          />
          {/* [H-04] Core 루브릭 점수 - optional 필드이므로 조건부 렌더링 */}
          {typeof scoreC.breakdown.trust === "number" && (
            <ScoreBar
              label="신뢰성"
              score={scoreC.breakdown.trust}
              color="cyan"
            />
          )}
          {typeof scoreC.breakdown.persuasion === "number" && (
            <ScoreBar
              label="설득력"
              score={scoreC.breakdown.persuasion}
              color="pink"
            />
          )}
        </div>

        {/* 액션 아이템 */}
        {scoreC.actionItems.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              🚀 개선 항목
            </h4>
            <ul className="space-y-1">
              {scoreC.actionItems.map((item, index) => (
                <li
                  key={index}
                  className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-100 dark:border-amber-800"
                >
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {index + 1}.
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

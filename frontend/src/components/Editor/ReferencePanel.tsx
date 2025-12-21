
import { type TemplateSchema } from '@/lib/rag/templateTypes'

interface ReferencePanelProps {
  template?: TemplateSchema[]
  isLoading?: boolean
}

export default function ReferencePanel({ template, isLoading }: ReferencePanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        템플릿 로딩 중...
      </div>
    )
  }

  if (!template || template.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
        <p>참고할 템플릿이 없습니다.</p>
        <p className="text-sm mt-2">문서를 선택하여 템플릿을 로드해주세요.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          참고 템플릿 (Reference)
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          이 스타일을 참고하여 글을 작성하세요.
        </p>
      </div>

      <div className="p-4 space-y-6">
        {template.map((item, index) => (
          <div key={item.criteria_id || index} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                {item.category}
              </span>
            </div>

            <div className="prose dark:prose-invert max-w-none">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {item.rationale}
              </h3>
            </div>

            {/* 긍정 예시 */}
            {item.positive_examples.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-100 dark:border-green-900/30">
                <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                  <span>👍</span> Good Examples
                </h4>
                <ul className="space-y-2">
                  {item.positive_examples.map((ex, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                      <span className="text-green-500">•</span>
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 부정 예시 */}
            {item.negative_examples.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-100 dark:border-red-900/30">
                <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                  <span>👎</span> Bad Examples
                </h4>
                <ul className="space-y-2">
                  {item.negative_examples.map((ex, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                      <span className="text-red-500">•</span>
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <hr className="border-gray-100 dark:border-gray-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

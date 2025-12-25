
import DocumentUploader from '@/components/documents/DocumentUploader'
import DocumentCard from './DocumentCard'
import { DocumentStatus } from '@/types/rag' // Import shared type

// Re-defining interface locally to avoid 'any' if import fails, but ideally should match useDocumentStatus return type
interface Document {
  id: string
  title: string
  file_size: number
  status: any // Using specific status type in card
  error_message?: string
  created_at?: string
}

interface DocumentListPanelProps {
  documents: Document[]
  selectedDocId: string | null
  onSelectDoc: (id: string | null) => void
  onRefresh: () => void
  onDeleteDoc: (id: string) => Promise<void>
  className?: string
}

export default function DocumentListPanel({
  documents,
  selectedDocId,
  onSelectDoc,
  onRefresh,
  onDeleteDoc,
  className = ''
}: DocumentListPanelProps) {
  
  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
          Knowledge Source ({documents.length})
        </h2>
        
        {/* Upload Area */}
        <DocumentUploader onUploadSuccess={onRefresh} />
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
            <span className="text-2xl mb-2">📂</span>
            <span>업로드된 문서가 없습니다</span>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              id={doc.id}
              title={doc.title}
              fileSize={doc.file_size}
              status={doc.status as DocumentStatus}
              errorMessage={doc.error_message}
              isSelected={selectedDocId === doc.id}
              onClick={() => onSelectDoc(doc.id)}
              onDelete={() => onDeleteDoc(doc.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

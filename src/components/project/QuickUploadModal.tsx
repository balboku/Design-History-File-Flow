'use client'

import { useRef, useState, useCallback } from 'react'
import { Role } from '@prisma/client'
import { formatRole } from '@/lib/ui-labels'

interface MissingDeliverable {
  deliverableId: string
  deliverableCode: string
  deliverableTitle: string
}

interface Props {
  taskId: string
  taskCode: string
  taskTitle: string
  missingDeliverables: MissingDeliverable[]
  lookupUsers: { id: string; name: string; role: Role }[]
  onSuccess: () => void
  onClose: () => void
}

export function QuickUploadModal({
  taskId,
  taskCode,
  taskTitle,
  missingDeliverables,
  lookupUsers,
  onSuccess,
  onClose,
}: Props) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedById, setUploadedById] = useState('')
  const [changeSummary, setChangeSummary] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const qaUsers = lookupUsers.filter(
    (u) => u.role === Role.QA || u.role === Role.ADMIN || u.role === Role.PM,
  )

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleSubmit = async () => {
    if (!selectedFile) { setError('請選擇或拖曳一個檔案。'); return }
    if (!uploadedById) { setError('請選擇上傳者身份。'); return }

    setIsSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('uploadedById', uploadedById)
    if (changeSummary) formData.append('changeSummary', changeSummary)

    try {
      const res = await fetch(`/api/tasks/${taskId}/complete-with-upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        onSuccess()
      } else {
        setError(data.error ?? '上傳失敗，請再試一次。')
      }
    } catch {
      setError('網路錯誤，請確認連線狀態後再試。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-[14px] font-medium text-slate-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"

  return (
    <dialog
      open
      className="fixed inset-0 z-[60] flex h-[100vh] w-[100vw] items-center justify-center m-0 bg-slate-900/50 p-4 sm:p-6 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[32px] bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] ring-1 ring-slate-900/5">
        {/* Header */}
        <div className="border-b border-slate-100 bg-orange-50/60 p-7 pb-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-orange-700">
                  合規閘門
                </span>
              </div>
              <h3 className="m-0 text-xl font-bold tracking-tight text-slate-900">
                標記完成前須上傳文件
              </h3>
              <p className="mt-1.5 mb-0 text-[14px] font-medium leading-relaxed text-slate-500">
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mr-1">{taskCode}</span>
                {taskTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-7 flex flex-col gap-5">
          {/* Missing Deliverables */}
          <div>
            <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">缺少版次的文件 ({missingDeliverables.length} 份)</div>
            <div className="flex flex-col gap-2">
              {missingDeliverables.map((d) => (
                <div key={d.deliverableId} className="flex items-center gap-2.5 rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-700">{d.deliverableCode}</span>
                  <span className="text-[13px] font-medium text-slate-700">{d.deliverableTitle}</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[12px] text-slate-500 leading-relaxed">
              上傳的檔案將同時登記至以上所有文件，作為 r1 初版。
            </p>
          </div>

          {/* Dropzone */}
          <div>
            <div className="mb-2 text-[13px] font-bold text-slate-700">選擇或拖曳檔案</div>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
              onDragLeave={() => setIsDraggingOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
                isDraggingOver
                  ? 'border-blue-400 bg-blue-50'
                  : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/60'
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-1 px-6 text-center">
                  <svg className="h-7 w-7 text-emerald-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[14px] font-bold text-emerald-700">{selectedFile.name}</span>
                  <span className="text-[12px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB · 點擊替換</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 px-6 text-center">
                  <svg className="h-8 w-8 text-slate-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-[14px] font-bold text-slate-500">拖曳或點擊選擇檔案</span>
                  <span className="text-[12px] text-slate-400">支援任意格式</span>
                </div>
              )}
            </div>
          </div>

          {/* Uploader */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-slate-700">上傳者身份</label>
            <select
              value={uploadedById}
              onChange={(e) => setUploadedById(e.target.value)}
              className={inputClass}
              required
            >
              <option value="" disabled>請選擇您的帳號</option>
              {qaUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({formatRole(u.role)})
                </option>
              ))}
            </select>
          </div>

          {/* Change Summary */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-slate-700">版更摘要 (選填)</label>
            <textarea
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="簡述此次上傳的內容或變更緣由..."
              className={`${inputClass} min-h-[80px] resize-y`}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-[13px] font-bold text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-800 px-5 py-4 text-[15px] font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              {isSubmitting ? '上傳並結案中…' : '上傳文件並標記任務完成'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[14px] font-bold text-slate-500 transition-colors hover:bg-slate-50 focus:outline-none"
            >
              取消，稍後再處理
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}

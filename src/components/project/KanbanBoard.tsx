'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { Role } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { startTaskAction, completeTaskAction, updateTaskAction } from '@/actions/task-actions'
import { createAttachmentAction, getTaskAttachmentsAction, deleteAttachmentAction } from '@/actions/attachment-actions'
import { TaskCard, type KanbanTask } from './TaskCard'
import { KanbanColumn } from './KanbanColumn'
import { QuickUploadModal } from './QuickUploadModal'

// ─── Task Edit Dialog Component ────────────────────────────────────────────

interface TaskEditDialogProps {
  task: KanbanTask & {
    checklistItems?: { id: string; content: string; isCompleted: boolean }[]
    blockedBy?: { id: string; code: string; title: string; status: string }[]
  }
  lookupUsers: { id: string; name: string; role: Role }[]
  projectTasks: KanbanTask[]
  onClose: () => void
  onSaveSuccess: () => void
}

function TaskEditDialog({ task, lookupUsers, projectTasks, onClose, onSaveSuccess }: TaskEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ id: string; fileName: string }>>(task.attachments || [])
  const [checklists, setChecklists] = useState<Array<{ id: string; content: string; isCompleted: boolean }>>(task.checklistItems || [])
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [comments, setComments] = useState<Array<{ id: string; content: string; authorName: string; createdAt: string }>>([])
  const [newComment, setNewComment] = useState('')
  const [showChecklistSection, setShowChecklistSection] = useState(false)
  const [showAttachmentSection, setShowAttachmentSection] = useState(false)
  const [showCommentSection, setShowCommentSection] = useState(false)
  // 前置任務選取狀態
  const [selectedPredecessors, setSelectedPredecessors] = useState<string[]>(
    task.blockedBy?.map((b) => b.id) || []
  )
  const router = useRouter()

  const currentUserId = lookupUsers.find((u) => u.role === 'RD')?.id || ''

  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return
    const file = files[0]

    setIsUploadingFile(true)
    setError(null)

    try {
      // 这是一个模拟实现，实际需要配置上传端点
      // 在生产环境中应该调用真实的上传 API
      const reader = new FileReader()
      reader.onload = async () => {
        // 这里应该与后端 API 通信进行實際上傳
        // 暂时模拟成功
        const newAttachment = {
          id: 'temp-' + Date.now(),
          fileName: file.name,
        }
        setAttachments([newAttachment, ...attachments])
      }
      reader.readAsArrayBuffer(file)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'File upload failed'
      setError(message)
    } finally {
      setIsUploadingFile(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleRemoveAttachment = async (attachmentId: string) => {
    // 移除本地显示
    setAttachments(attachments.filter(a => a.id !== attachmentId))

    // 如果是真实附件ID（不以 temp- 开头），则调用删除 API
    if (!attachmentId.startsWith('temp-')) {
      await deleteAttachmentAction(attachmentId, currentUserId)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const assigneeId = formData.get('assigneeId') as string | null
    const plannedStartDate = formData.get('plannedStartDate') as string | null
    const targetDate = formData.get('targetDate') as string | null

    try {
      const result = await updateTaskAction({
        taskId: task.id,
        title: title || undefined,
        description: description || null,
        assigneeId: assigneeId || null,
        plannedStartDate: plannedStartDate || null,
        targetDate: targetDate || null,
        actorId: currentUserId || undefined,
        blockedByIds: selectedPredecessors,
      })

      if (result.success) {
        onSaveSuccess()
      } else {
        setError(result.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDateForInput = (date: Date | string | null | undefined): string => {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const rdUsers = lookupUsers.filter((u) => u.role === 'RD')

  return (
    <dialog
      open
      className="fixed inset-0 z-[80] flex h-full w-full items-center justify-center m-0 bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-[500px] rounded-[20px] bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <h2 className="m-0 text-[18px] font-bold text-slate-800 mb-4">編輯任務 · {task.code}</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-red-50 px-3.5 py-3 text-[13px] font-bold text-red-700">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              標題
            </label>
            <input
              id="title"
              type="text"
              name="title"
              defaultValue={task.title}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              描述
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={task.description || ''}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none resize-none"
            />
          </div>

          {/* Assignee */}
          <div>
            <label htmlFor="assigneeId" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              負責人
            </label>
            <select
              id="assigneeId"
              name="assigneeId"
              defaultValue={task.assigneeId || ''}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="">未指派</option>
              {rdUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Planned Start Date */}
          <div>
            <label htmlFor="plannedStartDate" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              預計開始日期
            </label>
            <input
              id="plannedStartDate"
              type="date"
              name="plannedStartDate"
              defaultValue={formatDateForInput(task.plannedStartDate)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Target Date (Completion Date) */}
          <div>
            <label htmlFor="targetDate" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              目標完成日期
            </label>
            <input
              id="targetDate"
              type="date"
              name="targetDate"
              defaultValue={formatDateForInput(task.targetDate)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Predecessors (前置任務) */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              前置任務 (Predecessors)
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
                {projectTasks
                  .filter((t) => t.id !== task.id) // 排除當前任務，避免循環依賴
                  .map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2.5 cursor-pointer hover:bg-white px-2 py-1.5 rounded-lg transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPredecessors.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPredecessors([...selectedPredecessors, t.id])
                          } else {
                            setSelectedPredecessors(selectedPredecessors.filter((id) => id !== t.id))
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[13px] text-slate-700 font-medium">
                        <span className="font-bold text-slate-800">{t.code}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        {t.title}
                      </span>
                    </label>
                  ))}
                {projectTasks.filter((t) => t.id !== task.id).length === 0 && (
                  <div className="text-[13px] text-slate-400 text-center py-2">
                    專案中沒有其他可選擇的任務
                  </div>
                )}
              </div>
              {selectedPredecessors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 mb-1.5">已選擇 {selectedPredecessors.length} 項前置任務</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedPredecessors.map((id) => {
                      const t = projectTasks.find((pt) => pt.id === id)
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"
                        >
                          {t?.code || id.slice(0, 6)}
                          <button
                            type="button"
                            onClick={() => setSelectedPredecessors(selectedPredecessors.filter((pid) => pid !== id))}
                            className="hover:text-amber-900"
                          >
                            ✕
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              選擇此任務的前置任務，系統將在甘特圖中顯示連線關係。
            </p>
          </div>

          {/* Attachments Section (Collapsible) */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowAttachmentSection(!showAttachmentSection)}
              className="flex items-center justify-between w-full text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 hover:text-slate-800"
            >
              <span>參考附件 ({attachments.length})</span>
              <svg 
                className={`h-4 w-4 transition-transform ${showAttachmentSection ? 'rotate-180' : ''}`} 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showAttachmentSection && (
              <div className="space-y-3">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
                    dragActive
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="file"
                    id="attachment-input"
                    onChange={(e) => handleFileUpload(e.currentTarget.files || new FileList())}
                    className="hidden"
                    disabled={isUploadingFile}
                  />
                  <label
                    htmlFor="attachment-input"
                    className="flex flex-col items-center gap-2 cursor-pointer"
                  >
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span className="text-[12px] font-bold text-slate-600">
                      {isUploadingFile ? '上傳中...' : '拖放檔案或點擊選擇'}
                    </span>
                  </label>
                </div>
                
                <p className="px-1 text-[11px] font-bold text-amber-600 bg-amber-50 rounded-md py-1">
                  ⚠️ 提示：此處僅供上傳開發參考附件，正式 DHF 報告請至『文件庫』上傳新版次。
                </p>

                {/* Attachments List */}
                {attachments.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span className="truncate text-slate-700 font-medium">{att.fileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="shrink-0 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Checklist Section */}
          <div>
            <button
              type="button"
              onClick={() => setShowChecklistSection(!showChecklistSection)}
              className="flex items-center justify-between w-full text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 hover:text-slate-800"
            >
              <span>子任務清單</span>
              <svg 
                className={`h-4 w-4 transition-transform ${showChecklistSection ? 'rotate-180' : ''}`} 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showChecklistSection && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {/* Checklist Items */}
                {checklists.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-3">
                    {checklists.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() => {
                            setChecklists(checklists.map(c => 
                              c.id === item.id ? { ...c, isCompleted: !c.isCompleted } : c
                            ))
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-[13px] ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {item.content}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Add New Checklist Item */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="新增子任務..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newChecklistItem.trim()) {
                        setChecklists([...checklists, { 
                          id: 'temp-' + Date.now(), 
                          content: newChecklistItem.trim(), 
                          isCompleted: false 
                        }])
                        setNewChecklistItem('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newChecklistItem.trim()) {
                        setChecklists([...checklists, { 
                          id: 'temp-' + Date.now(), 
                          content: newChecklistItem.trim(), 
                          isCompleted: false 
                        }])
                        setNewChecklistItem('')
                      }
                    }}
                    className="shrink-0 rounded-lg bg-blue-500 px-3 py-2 text-[13px] font-bold text-white hover:bg-blue-600"
                  >
                    新增
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Comments Section (Collapsible) */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowCommentSection(!showCommentSection)}
              className="flex items-center justify-between w-full text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 hover:text-slate-800"
            >
              <span>討論留言 ({comments.length})</span>
              <svg 
                className={`h-4 w-4 transition-transform ${showCommentSection ? 'rotate-180' : ''}`} 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showCommentSection && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              {/* Existing Comments */}
              {comments.length > 0 && (
                <div className="flex flex-col gap-2 mb-3 max-h-32 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-white p-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold text-blue-600">{comment.authorName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(comment.createdAt).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-700">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Comment */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="新增留言..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newComment.trim()) {
                      setComments([...comments, { 
                        id: 'temp-' + Date.now(), 
                        content: newComment.trim(), 
                        authorName: lookupUsers.find(u => u.role === 'RD')?.name || 'User',
                        createdAt: new Date().toISOString()
                      }])
                      setNewComment('')
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newComment.trim()) {
                      setComments([...comments, { 
                        id: 'temp-' + Date.now(), 
                        content: newComment.trim(), 
                        authorName: lookupUsers.find(u => u.role === 'RD')?.name || 'User',
                        createdAt: new Date().toISOString()
                      }])
                      setNewComment('')
                    }
                  }}
                  className="shrink-0 rounded-lg bg-slate-600 px-3 py-2 text-[13px] font-bold text-white hover:bg-slate-700"
                >
                  送出
                </button>
              </div>
            </div>
          )}
        </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}

type ColumnId = 'Todo' | 'InProgress' | 'Done'
const COLUMNS: ColumnId[] = ['Todo', 'InProgress', 'Done']

interface Props {
  projectId: string
  tasks: KanbanTask[]
  lookupUsers: { id: string; name: string; role: Role }[]
}

export function KanbanBoard({ projectId, tasks, lookupUsers }: Props) {
  const router = useRouter()
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null)
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null)
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null)
  // Optimistic task statuses: taskId → status
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, string>>({})
  // Upload Modal state (for InProgress -> Done dragging missing files)
  const [uploadModal, setUploadModal] = useState<{
    taskId: string
    taskCode: string
    taskTitle: string
    missingDeliverables: { deliverableId: string; deliverableCode: string; deliverableTitle: string }[]
    onlyUpload?: boolean
    allDeliverables?: { deliverableId: string; deliverableCode: string; deliverableTitle: string }[]
  } | null>(null)
  
  // Ghost Dropzone state (direct file drop onto TaskCard)
  const [ghostUpload, setGhostUpload] = useState<{
    file: File
    taskId: string
    deliverableId: string
    projectId: string
    deliverableCode: string
  } | null>(null)
  const [ghostIsSubmitting, setGhostIsSubmitting] = useState(false)
  const [ghostUploadedById, setGhostUploadedById] = useState('')

  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<string>('all')

  const rdUsers = lookupUsers.filter((u) => u.role === 'RD')

  const filteredTasks = tasks.filter((task) => {
    if (filterAssignee === 'all') return true
    if (filterAssignee === 'unassigned') return !task.assigneeId
    return task.assigneeId === filterAssignee
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const getStatus = useCallback(
    (task: KanbanTask): string => optimisticStatus[task.id] ?? task.status,
    [optimisticStatus],
  )

  const tasksByColumn = COLUMNS.reduce<Record<ColumnId, KanbanTask[]>>(
    (acc, col) => {
      acc[col] = filteredTasks.filter((t) => getStatus(t) === col)
      return acc
    },
    { Todo: [], InProgress: [], Done: [] },
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === active.id)
    if (task) setActiveTask(task)
    setErrorBanner(null)
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverColumn(over?.id as ColumnId ?? null)
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    setOverColumn(null)

    if (!over) return

    const task = tasks.find((t) => t.id === active.id)
    if (!task) return

    const fromStatus = getStatus(task) as ColumnId
    const toStatus = over.id as ColumnId

    if (fromStatus === toStatus) return

    // Block: Done → anything, or Todo → Done (must pass through InProgress)
    if (fromStatus === 'Done') { setErrorBanner('已完成的任務無法退回。'); return }
    if (fromStatus === 'Todo' && toStatus === 'Done') { setErrorBanner('任務必須先進入「進行中」才能標記完成。'); return }
    // Block: InProgress → Todo (backward)
    if (fromStatus === 'InProgress' && toStatus === 'Todo') { setErrorBanner('進行中的任務無法退回待開始。'); return }

    // Todo → InProgress
    if (fromStatus === 'Todo' && toStatus === 'InProgress') {
      setOptimisticStatus((prev) => ({ ...prev, [task.id]: 'InProgress' }))
      const res = await startTaskAction(task.id)
      if (res.success) {
        router.refresh()
      } else {
        setOptimisticStatus((prev) => { const n = { ...prev }; delete n[task.id]; return n })
        setErrorBanner(res.error)
      }
      return
    }

    // InProgress → Done
    if (fromStatus === 'InProgress' && toStatus === 'Done') {
      const missingDeliverables = task.deliverableLinks
        .filter((l) => l.deliverable.fileRevisions.length === 0)
        .map((l) => ({
          deliverableId: l.deliverable.id,
          deliverableCode: l.deliverable.code,
          deliverableTitle: l.deliverable.title,
        }))

      if (missingDeliverables.length > 0) {
        // Show upload modal instead of calling completeTask (which would fail)
        setUploadModal({
          taskId: task.id,
          taskCode: task.code,
          taskTitle: task.title,
          missingDeliverables,
        })
        return
      }

      // All deliverables have revisions — complete directly
      setOptimisticStatus((prev) => ({ ...prev, [task.id]: 'Done' }))
      const res = await completeTaskAction(task.id)
      if (res.success) {
        router.refresh()
      } else {
        setOptimisticStatus((prev) => { const n = { ...prev }; delete n[task.id]; return n })
        if (res.isFileMissingError) {
          // Edge case: file was deleted between render and action — fallback to modal
          const missing = task.deliverableLinks.map((l) => ({
            deliverableId: l.deliverable.id,
            deliverableCode: l.deliverable.code,
            deliverableTitle: l.deliverable.title,
          }))
          setUploadModal({ taskId: task.id, taskCode: task.code, taskTitle: task.title, missingDeliverables: missing })
        } else {
          setErrorBanner(res.error)
        }
      }
    }
  }

  const handleGhostFileDrop = (taskId: string, files: FileList) => {
    const file = files[0]
    if (!file) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const missingLink = task.deliverableLinks.find((l) => l.deliverable.fileRevisions.length === 0)
    const targetLink = missingLink ?? task.deliverableLinks[0]
    if (!targetLink) {
      setErrorBanner('該任務沒有綁定任何文件，無法上傳。')
      return
    }

    setGhostUpload({
      file,
      taskId,
      deliverableId: targetLink.deliverable.id,
      projectId,
      deliverableCode: targetLink.deliverable.code,
    })
  }

  const handleGhostSubmit = async () => {
    if (!ghostUpload || !ghostUploadedById) return

    setGhostIsSubmitting(true)
    setErrorBanner(null)

    const formData = new FormData()
    formData.append('file', ghostUpload.file)
    formData.append('uploadedById', ghostUploadedById)

    try {
      // API redirects on success, so we fetch it manually to not lose our client state fully,
      // but actually a redirect will return HTML. Let's just do a normal fetch and hope we can ignore the response,
      // or we can submit it properly.
      const res = await fetch(`/api/projects/${ghostUpload.projectId}/deliverables/${ghostUpload.deliverableId}/revisions`, {
        method: 'POST',
        body: formData,
        redirect: 'manual', // Don't follow redirect, just reload after
      })
      
      setGhostUpload(null)
      router.refresh()
    } catch (err) {
      setErrorBanner('直接拖曳檔案上傳失敗。')
    } finally {
      setGhostIsSubmitting(false)
    }
  }

  const handleUploadSuccess = () => {
    setUploadModal(null)
    setOptimisticStatus((prev) => {
      if (!uploadModal) return prev
      return { ...prev, [uploadModal.taskId]: 'Done' }
    })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {errorBanner && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-3.5 text-[13px] font-bold text-red-700 shadow-sm">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Task Filter */}
      <div className="flex items-center gap-3">
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="w-full max-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-medium text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none"
        >
          <option value="all">顯示所有人</option>
          <option value="unassigned">尚未指派</option>
          {rdUsers.map((user) => (
            <option key={user.id} value={user.id}>
              只看 {user.name} 的任務
            </option>
          ))}
        </select>
        <span className="text-[12px] text-slate-400">
          共 {filteredTasks.length} 項任務
        </span>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              id={col}
              count={tasksByColumn[col].length}
              isOver={overColumn === col}
            >
              {tasksByColumn[col].map((task) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onFileDrop={handleGhostFileDrop} 
                  onQuickUpload={(t) => setUploadModal({
                    taskId: t.id,
                    taskCode: t.code,
                    taskTitle: t.title,
                    missingDeliverables: t.deliverableLinks.map(l => ({
                      deliverableId: l.deliverable.id,
                      deliverableCode: l.deliverable.code,
                      deliverableTitle: l.deliverable.title
                    })),
                    onlyUpload: true,
                    allDeliverables: t.deliverableLinks.map(l => ({
                      deliverableId: l.deliverable.id,
                      deliverableCode: l.deliverable.code,
                      deliverableTitle: l.deliverable.title
                    }))
                  })}
                  onClick={(t) => setEditingTask(t)} 
                />
              ))}
              {tasksByColumn[col].length === 0 && (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-[13px] font-medium text-slate-400">
                  {col === 'Todo' ? '— 尚無待開始任務 —' : col === 'InProgress' ? '— 尚無進行中任務 —' : '— 拖曳完成任務放置於此 —'}
                </div>
              )}
            </KanbanColumn>
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
          {activeTask ? <TaskCard task={activeTask} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Task Edit Dialog */}
      {editingTask && (
        <TaskEditDialog
          task={editingTask}
          lookupUsers={lookupUsers}
          projectTasks={tasks}
          onClose={() => setEditingTask(null)}
          onSaveSuccess={() => {
            setEditingTask(null)
            router.refresh()
          }}
        />
      )}

      {/* Ghost Drop Uploader Modal */}
      {ghostUpload && (
        <dialog
          open
          className="fixed inset-0 z-[70] flex h-full w-full items-center justify-center m-0 bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setGhostUpload(null) }}
        >
          <div className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <h3 className="m-0 text-[16px] font-bold text-slate-800 mb-2">上傳文件：{ghostUpload.file.name}</h3>
            <p className="m-0 text-[13px] text-slate-500 mb-5">
              將上傳為 <span className="font-bold text-slate-700">{ghostUpload.deliverableCode}</span> 的新版次。請選擇上傳者：
            </p>
            <select
              value={ghostUploadedById}
              onChange={(e) => setGhostUploadedById(e.target.value)}
              className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="" disabled>請選擇您的帳號</option>
              {lookupUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGhostUpload(null)}
                className="rounded-lg px-4 py-2 text-[13px] font-bold text-slate-500 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!ghostUploadedById || ghostIsSubmitting}
                onClick={handleGhostSubmit}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {ghostIsSubmitting ? '上傳中...' : '確認上傳'}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Quick Upload Modal (for resolving Done status) */}
      {uploadModal && (
        <QuickUploadModal
          taskId={uploadModal.taskId}
          taskCode={uploadModal.taskCode}
          taskTitle={uploadModal.taskTitle}
          missingDeliverables={uploadModal.missingDeliverables}
          onlyUpload={uploadModal.onlyUpload}
          allDeliverables={uploadModal.allDeliverables}
          lookupUsers={lookupUsers}
          onSuccess={handleUploadSuccess}
          onClose={() => setUploadModal(null)}
        />
      )}
    </div>
  )
}

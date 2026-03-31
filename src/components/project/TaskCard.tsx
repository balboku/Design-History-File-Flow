'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ProjectPhase } from '@prisma/client'

export interface KanbanTask {
  id: string
  code: string
  title: string
  description?: string | null
  status: string
  plannedPhase: ProjectPhase
  assigneeId?: string | null
  plannedStartDate?: Date | string | null
  targetDate?: Date | string | null
  assignee?: { name?: string } | null
  deliverableLinks: {
    deliverable: {
      id: string
      code: string
      title: string
      fileRevisions: { id: string }[]
    }
  }[]
  attachments?: {
    id: string
    fileName: string
  }[]
  checklistItems?: {
    id: string
    content: string
    isCompleted: boolean
  }[]
  blockedBy?: {
    id: string
    code: string
    status: string
    title: string
  }[]
}

interface Props {
  task: KanbanTask
  isDragOverlay?: boolean
  onFileDrop?: (taskId: string, files: FileList) => void
  onQuickUpload?: (task: KanbanTask) => void
  onClick?: (task: KanbanTask) => void
}

export function TaskCard({ task, isDragOverlay = false, onFileDrop, onQuickUpload, onClick }: Props) {
  const [isGhostHover, setIsGhostHover] = useState(false)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const isOverdue =
    !!task.targetDate &&
    new Date(task.targetDate as string) < new Date() &&
    task.status !== 'Done'

  const missingFiles = task.deliverableLinks.filter(
    (l) => l.deliverable.fileRevisions.length === 0,
  )
  const allFilesUploaded = task.deliverableLinks.length > 0 && missingFiles.length === 0
  const uploadedCount = task.deliverableLinks.length - missingFiles.length

  const checklistItems = task.checklistItems || []
  const completedCount = checklistItems.filter(item => item.isCompleted).length
  const hasChecklists = checklistItems.length > 0

  const isBlocked = task.blockedBy && task.blockedBy.length > 0 && 
    task.blockedBy.some(blocked => blocked.status !== 'Done')

  // 计算任务进度百分比
  const getProgressPercentage = (): number => {
    if (task.status === 'Done') return 100
    if (task.status === 'InProgress') {
      if (hasChecklists) {
        const checklistProgress = (completedCount / checklistItems.length) * 100
        return Math.round(Math.min(checklistProgress, 99))
      }
      const fileProgress = uploadedCount / task.deliverableLinks.length * 100
      return Math.round(Math.min(fileProgress, 99))
    }
    return 0
  }

  const progressPercentage = getProgressPercentage()
  const attachmentCount = task.attachments?.length ?? 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onClick?.(task)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          e.stopPropagation()
          setIsGhostHover(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          setIsGhostHover(false)
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          setIsGhostHover(false)
          if (onFileDrop) onFileDrop(task.id, e.dataTransfer.files)
        }
      }}
      className={`relative group select-none rounded-2xl border bg-white p-4 shadow-sm transition-all ${
        isDragging
          ? 'opacity-40 shadow-none'
          : isDragOverlay
            ? 'rotate-[1.5deg] scale-[1.02] shadow-2xl ring-2 ring-blue-500/30'
            : isGhostHover
              ? 'border-blue-400 bg-blue-50 ring-4 ring-blue-500/20'
              : allFilesUploaded && task.status === 'InProgress'
                ? 'cursor-grab border-l-4 border-emerald-300 bg-slate-50/20 hover:border-emerald-400 hover:shadow-md active:cursor-grabbing'
                : 'cursor-grab border-slate-100/50 hover:border-slate-300 hover:shadow-md active:cursor-grabbing'
      }`}
    >
      {/* Ghost Drop Overlay */}
      {isGhostHover && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-blue-50/80 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-1.5 text-blue-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-[14px] font-bold">在此放開以自動上傳文件</span>
          </div>
        </div>
      )}

      {/* Task code + warning badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {task.code}
        </span>
        <div className="flex gap-1">
          {isBlocked && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              被阻擋
            </span>
          )}
          {(isOverdue || missingFiles.length > 0) && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">
              {isOverdue ? '逾期' : '缺檔'}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="m-0 mb-3 text-[15px] font-bold leading-snug tracking-tight text-slate-800">
        {task.title}
      </h4>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-slate-500">
        <span className="flex items-center gap-1">
          <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {task.assignee?.name ?? '未指派'}
        </span>
      </div>

      {/* Progress section - Checklist or Deliverable */}
      {(hasChecklists || task.deliverableLinks.length > 0) && (
        <div className="mt-3 flex flex-col gap-2">
          {/* Progress Bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-400 min-w-10 text-right">
              {progressPercentage}%
            </span>
          </div>

          {/* Checklist Status */}
          {hasChecklists && (
            <div className="flex items-center gap-1">
              {checklistItems.map((item) => (
                <span
                  key={item.id}
                  title={item.content}
                  className={`h-2.5 w-2.5 rounded-full border transition-colors ${
                    item.isCompleted
                      ? 'bg-emerald-400 border-emerald-300'
                      : 'bg-white border-slate-300'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Deliverable Status (if no checklists) */}
          {!hasChecklists && task.deliverableLinks.length > 0 && (
            <div className="flex items-center gap-1">
              {task.deliverableLinks.map((l) => (
                <span
                  key={l.deliverable.id}
                  title={`${l.deliverable.code} · ${l.deliverable.fileRevisions.length > 0 ? '已上傳' : '待上傳'}`}
                  className={`h-2.5 w-2.5 rounded-full border transition-colors ${
                    l.deliverable.fileRevisions.length > 0
                      ? 'bg-emerald-400 border-emerald-300'
                      : 'bg-white border-slate-300'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-1">
            <span className={`text-[11px] font-bold ${
              (hasChecklists ? completedCount === checklistItems.length : allFilesUploaded) ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              {hasChecklists 
                ? `${completedCount}/${checklistItems.length} 項目完成`
                : `${uploadedCount}/${task.deliverableLinks.length} 交付項目`
              }
              {attachmentCount > 0 && ` · ${attachmentCount} 附件`}
            </span>
            
            {!allFilesUploaded && task.status === 'InProgress' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickUpload?.(task)
                }}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-100 transition-colors"
              >
                📎 快速上傳
              </button>
            )}
          </div>
        </div>
      )}

      {/* Missing file warning */}
      {missingFiles.length > 0 && task.status === 'InProgress' && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[12px] font-bold text-orange-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          缺少 {missingFiles.length} 項交付項目
        </div>
      )}
    </div>
  )
}

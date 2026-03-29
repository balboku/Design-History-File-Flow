'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ProjectPhase, Role } from '@prisma/client'
import { StatusPill } from '@/components/app-shell'
import { formatProjectPhase, formatTaskStatus } from '@/lib/ui-labels'

export interface KanbanTask {
  id: string
  code: string
  title: string
  description?: string | null
  status: string
  plannedPhase: ProjectPhase
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
}

interface Props {
  task: KanbanTask
  isDragOverlay?: boolean
}

export function TaskCard({ task, isDragOverlay = false }: Props) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group select-none rounded-2xl border bg-white p-4 shadow-sm transition-all ${
        isDragging
          ? 'opacity-40 shadow-none'
          : isDragOverlay
            ? 'rotate-[1.5deg] scale-[1.02] shadow-2xl ring-2 ring-blue-500/30'
            : 'cursor-grab border-slate-200/60 hover:border-slate-300 hover:shadow-md active:cursor-grabbing'
      }`}
    >
      {/* Task code + overdued badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {task.code}
        </span>
        {isOverdue && (
          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">逾期</span>
        )}
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
        <span className="text-slate-300">·</span>
        <span>{formatProjectPhase(task.plannedPhase)}</span>
      </div>

      {/* Missing file warning */}
      {missingFiles.length > 0 && task.status === 'InProgress' && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[12px] font-bold text-orange-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          缺少 {missingFiles.length} 份文件 — 拖曳至完成時需上傳
        </div>
      )}
    </div>
  )
}

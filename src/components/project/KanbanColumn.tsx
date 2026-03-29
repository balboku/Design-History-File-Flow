'use client'

import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'

type ColumnId = 'Todo' | 'InProgress' | 'Done'

const COLUMN_CONFIG: Record<ColumnId, {
  label: string
  accent: string
  headerBg: string
  bodyBg: string
  badge: string
  badgeText: string
  dot: string
}> = {
  Todo: {
    label: '待開始',
    accent: 'border-slate-300',
    headerBg: 'bg-slate-50 border-b border-slate-200/60',
    bodyBg: 'bg-slate-50/40',
    badge: 'bg-slate-100',
    badgeText: 'text-slate-500',
    dot: 'bg-slate-400',
  },
  InProgress: {
    label: '進行中',
    accent: 'border-amber-300',
    headerBg: 'bg-amber-50/70 border-b border-amber-100',
    bodyBg: 'bg-amber-50/20',
    badge: 'bg-amber-100',
    badgeText: 'text-amber-700',
    dot: 'bg-amber-400',
  },
  Done: {
    label: '已完成',
    accent: 'border-emerald-300',
    headerBg: 'bg-emerald-50/70 border-b border-emerald-100',
    bodyBg: 'bg-emerald-50/20',
    badge: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    dot: 'bg-emerald-400',
  },
}

interface Props {
  id: ColumnId
  count: number
  children: ReactNode
  isOver?: boolean
}

export function KanbanColumn({ id, count, children, isOver }: Props) {
  const { setNodeRef } = useDroppable({ id })
  const cfg = COLUMN_CONFIG[id]

  return (
    <div
      className={`flex flex-col rounded-[24px] border bg-white shadow-sm transition-all ${cfg.accent} ${
        isOver ? 'ring-2 ring-blue-400/60 ring-offset-1' : ''
      }`}
    >
      {/* Column Header */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-t-[24px] ${cfg.headerBg}`}>
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
          <span className="text-[14px] font-bold tracking-tight text-slate-700">{cfg.label}</span>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${cfg.badge} ${cfg.badgeText}`}>
          {count}
        </span>
      </div>

      {/* Droppable body */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-3 rounded-b-[24px] p-4 min-h-[200px] transition-colors ${
          isOver ? 'bg-blue-50/30' : cfg.bodyBg
        }`}
      >
        {children}
      </div>
    </div>
  )
}

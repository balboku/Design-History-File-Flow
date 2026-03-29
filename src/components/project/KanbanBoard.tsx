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
import { startTaskAction, completeTaskAction } from '@/actions/task-actions'
import { TaskCard, type KanbanTask } from './TaskCard'
import { KanbanColumn } from './KanbanColumn'
import { QuickUploadModal } from './QuickUploadModal'

type ColumnId = 'Todo' | 'InProgress' | 'Done'
const COLUMNS: ColumnId[] = ['Todo', 'InProgress', 'Done']

interface Props {
  tasks: KanbanTask[]
  lookupUsers: { id: string; name: string; role: Role }[]
}

export function KanbanBoard({ tasks, lookupUsers }: Props) {
  const router = useRouter()
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null)
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null)
  // Optimistic task statuses: taskId → status
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, string>>({})
  // Upload Modal state
  const [uploadModal, setUploadModal] = useState<{
    taskId: string
    taskCode: string
    taskTitle: string
    missingDeliverables: { deliverableId: string; deliverableCode: string; deliverableTitle: string }[]
  } | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const getStatus = useCallback(
    (task: KanbanTask): string => optimisticStatus[task.id] ?? task.status,
    [optimisticStatus],
  )

  const tasksByColumn = COLUMNS.reduce<Record<ColumnId, KanbanTask[]>>(
    (acc, col) => {
      acc[col] = tasks.filter((t) => getStatus(t) === col)
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
                <TaskCard key={task.id} task={task} />
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

      {uploadModal && (
        <QuickUploadModal
          taskId={uploadModal.taskId}
          taskCode={uploadModal.taskCode}
          taskTitle={uploadModal.taskTitle}
          missingDeliverables={uploadModal.missingDeliverables}
          lookupUsers={lookupUsers}
          onSuccess={handleUploadSuccess}
          onClose={() => setUploadModal(null)}
        />
      )}
    </div>
  )
}

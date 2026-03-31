'use server'

import { createTask, startTask, completeTask, updateTask, TASK_COMPLETION_ERROR, TASK_NOT_IN_PROGRESS_ERROR } from '@/lib/task-service'
import { ProjectPhase } from '@prisma/client'

// ─── Create Task ──────────────────────────────────────────────────────────────

export interface CreateTaskActionInput {
  projectId: string
  code: string
  title: string
  description?: string
  assigneeId?: string | null
  createdById?: string | null
  plannedPhase: ProjectPhase
  deliverableIds: string[]
  plannedStartDate?: string | null
  targetDate?: string | null
  blockedByIds?: string[]
}

export type CreateTaskActionResult = {
  success: true
  data: Awaited<ReturnType<typeof createTask>>['task']
} | {
  success: false
  error: string
}

export async function createTaskAction(
  input: CreateTaskActionInput
): Promise<CreateTaskActionResult> {
  try {
    const result = await createTask({
      ...input,
      plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : null,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      blockedByIds: input.blockedByIds,
    })
    return { success: true, data: result.task }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ─── Start Task ───────────────────────────────────────────────────────────────

export type StartTaskActionResult = {
  success: true
  data: Awaited<ReturnType<typeof startTask>>['task']
} | {
  success: false
  error: string
}

export async function startTaskAction(
  taskId: string
): Promise<StartTaskActionResult> {
  try {
    const result = await startTask(taskId)
    return { success: true, data: result.task }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ─── Complete Task ────────────────────────────────────────────────────────────

export type CompleteTaskActionResult = {
  success: true
  data: Awaited<ReturnType<typeof completeTask>>['task']
} | {
  success: false
  error: string
  isFileMissingError?: boolean
  isNotInProgressError?: boolean
}

export async function completeTaskAction(
  taskId: string
): Promise<CompleteTaskActionResult> {
  try {
    const result = await completeTask(taskId)
    return { success: true, data: result.task }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isFileMissingError = message.startsWith(TASK_COMPLETION_ERROR)
    const isNotInProgressError = message === TASK_NOT_IN_PROGRESS_ERROR
    return { success: false, error: message, isFileMissingError, isNotInProgressError }
  }
}

// ─── Update Task ──────────────────────────────────────────────────────────

export interface UpdateTaskActionInput {
  taskId: string
  title?: string
  description?: string | null
  assigneeId?: string | null
  plannedStartDate?: string | null
  targetDate?: string | null
  actorId?: string | null
  blockedByIds?: string[]
}

export type UpdateTaskActionResult = {
  success: true
  data: Awaited<ReturnType<typeof updateTask>>['task']
} | {
  success: false
  error: string
}

export async function updateTaskAction(
  input: UpdateTaskActionInput
): Promise<UpdateTaskActionResult> {
  try {
    const result = await updateTask({
      ...input,
      plannedStartDate: input.plannedStartDate ? new Date(input.plannedStartDate) : undefined,
      targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
      blockedByIds: input.blockedByIds,
    })
    return { success: true, data: result.task }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

'use server'

import { createTask, completeTask, TASK_COMPLETION_ERROR } from '@/lib/task-service'
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
    const result = await createTask(input)
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
    return { success: false, error: message, isFileMissingError }
  }
}

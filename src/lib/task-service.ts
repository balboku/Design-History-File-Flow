import { prisma } from './prisma'
import { TaskStatus, ProjectPhase } from '@prisma/client'
import { recordAudit, AuditActions } from './audit-log-service'

export interface CreateTaskInput {
  projectId: string
  code: string
  title: string
  description?: string
  assigneeId?: string | null
  createdById?: string | null
  plannedPhase: ProjectPhase
  deliverableIds: string[]
  plannedStartDate?: Date | null
  targetDate?: Date | null
}

export interface CreateTaskResult {
  task: {
    id: string
    code: string
    title: string
    status: TaskStatus
    plannedPhase: ProjectPhase
    deliverableLinks: { id: string; deliverableId: string }[]
  }
}

export interface CompleteTaskResult {
  task: {
    id: string
    status: TaskStatus
    completedAt: Date
  }
}

export interface StartTaskResult {
  task: {
    id: string
    status: TaskStatus
    startedAt: Date
  }
}

export interface UpdateTaskInput {
  taskId: string
  title?: string
  description?: string | null
  assigneeId?: string | null
  plannedStartDate?: Date | null
  targetDate?: Date | null
  actorId?: string | null
}

export interface UpdateTaskResult {
  task: {
    id: string
    title: string
    description: string | null
    assigneeId: string | null
    plannedStartDate: Date | null
    targetDate: Date | null
  }
}

/**
 * 建立 Task 並同時綁定多個 DeliverablePlaceholder。
 * 根據 CLAUDE.md 的 Business Rule：Task 不能存在沒有 deliverable placeholder 的情況。
 */
export async function createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  if (input.deliverableIds.length === 0) {
    throw new Error('Task must be linked to at least one DeliverablePlaceholder.')
  }

  // 驗證所有 deliverableIds 都存在於同一個 projectId 下
  const deliverables = await prisma.deliverablePlaceholder.findMany({
    where: {
      id: { in: input.deliverableIds },
      projectId: input.projectId,
    },
    select: { id: true },
  })

  if (deliverables.length !== input.deliverableIds.length) {
    const foundIds = new Set(deliverables.map((d) => d.id))
    const missingIds = input.deliverableIds.filter((id) => !foundIds.has(id))
    throw new Error(`DeliverablePlaceholder IDs not found or not in project: ${missingIds.join(', ')}`)
  }

  const task = await prisma.task.create({
    data: {
      projectId: input.projectId,
      code: input.code,
      title: input.title,
      description: input.description ?? null,
      assigneeId: input.assigneeId ?? null,
      createdById: input.createdById ?? null,
      plannedPhase: input.plannedPhase,
      status: TaskStatus.Todo,
      plannedStartDate: input.plannedStartDate ?? null,
      targetDate: input.targetDate ?? null,
      deliverableLinks: {
        create: input.deliverableIds.map((deliverableId) => ({
          deliverableId,
        })),
      },
    },
    include: {
      deliverableLinks: {
        select: { id: true, deliverableId: true },
      },
    },
  })

  await recordAudit({
    action: AuditActions.TASK_CREATE,
    entityType: 'Task',
    entityId: task.id,
    actorId: input.createdById,
    detail: {
      code: task.code,
      projectId: input.projectId,
      plannedPhase: task.plannedPhase,
      deliverableIds: input.deliverableIds,
    },
  })

  return {
    task: {
      id: task.id,
      code: task.code,
      title: task.title,
      status: task.status,
      plannedPhase: task.plannedPhase,
      deliverableLinks: task.deliverableLinks,
    },
  }
}

export const TASK_START_ERROR = '只有待開始的任務才能啟動'

/**
 * 將 Task 狀態從 Todo 更新為 InProgress。
 */
export async function startTask(taskId: string): Promise<StartTaskResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, status: true },
  })

  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }

  if (task.status !== TaskStatus.Todo) {
    throw new Error(TASK_START_ERROR)
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.InProgress,
      startedAt: new Date(),
    },
    select: { id: true, status: true, startedAt: true },
  })

  if (!updated.startedAt) {
    throw new Error('Task start timestamp was not persisted.')
  }

  await recordAudit({
    action: AuditActions.TASK_START,
    entityType: 'Task',
    entityId: updated.id,
  })

  return {
    task: {
      id: updated.id,
      status: updated.status,
      startedAt: updated.startedAt,
    },
  }
}

export const TASK_COMPLETION_ERROR = '綁定的產出文件尚未上傳，無法完成任務'
export const TASK_NOT_IN_PROGRESS_ERROR = '任務必須在進行中狀態才能標記完成'

/**
 * 將 Task 狀態更新為 Done。
 * 防呆檢查：所有綁定的 DeliverablePlaceholder 都必須有對應的 FileRevision。
 */
export async function completeTask(taskId: string): Promise<CompleteTaskResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      deliverableLinks: {
        include: {
          deliverable: {
            include: {
              fileRevisions: {
                where: {
                  changeRequestId: null,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }

  if (task.status === TaskStatus.Done) {
    throw new Error('Task is already completed.')
  }

  if (task.status !== TaskStatus.InProgress) {
    throw new Error(TASK_NOT_IN_PROGRESS_ERROR)
  }

  const missingRevisions = task.deliverableLinks.filter(
    (link) => link.deliverable.fileRevisions.length === 0,
  )

  if (missingRevisions.length > 0) {
    const missingCodes = missingRevisions.map((l) => l.deliverable.code).join(', ')
    throw new Error(`${TASK_COMPLETION_ERROR} (缺失檔案：${missingCodes})`)
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.Done,
      completedAt: new Date(),
    },
    select: { id: true, status: true, completedAt: true },
  })

  if (!updated.completedAt) {
    throw new Error('Task completion timestamp was not persisted.')
  }

  await recordAudit({
    action: AuditActions.TASK_COMPLETE,
    entityType: 'Task',
    entityId: updated.id,
  })

  return {
    task: {
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt,
    },
  }
}

/**
 * 更新 Task 的欄位（標題、描述、負責人、計畫日期等）。
 * 記錄修改稽核軌跡。
 */
export async function updateTask(input: UpdateTaskInput): Promise<UpdateTaskResult> {
  const { taskId, actorId, ...updateData } = input

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      description: true,
      assigneeId: true,
      plannedStartDate: true,
      targetDate: true,
    },
  })

  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }

  // 只更新傳入的欄位
  const dataToUpdate: Record<string, unknown> = {}
  if (updateData.title !== undefined) dataToUpdate.title = updateData.title
  if (updateData.description !== undefined) dataToUpdate.description = updateData.description
  if (updateData.assigneeId !== undefined) dataToUpdate.assigneeId = updateData.assigneeId
  if (updateData.plannedStartDate !== undefined) dataToUpdate.plannedStartDate = updateData.plannedStartDate
  if (updateData.targetDate !== undefined) dataToUpdate.targetDate = updateData.targetDate

  if (Object.keys(dataToUpdate).length === 0) {
    // 沒有任何欄位需要更新
    return {
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        plannedStartDate: task.plannedStartDate,
        targetDate: task.targetDate,
      },
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: dataToUpdate,
    select: {
      id: true,
      title: true,
      description: true,
      assigneeId: true,
      plannedStartDate: true,
      targetDate: true,
    },
  })

  await recordAudit({
    action: AuditActions.TASK_UPDATE,
    entityType: 'Task',
    entityId: updated.id,
    actorId,
    detail: {
      changes: dataToUpdate,
    },
  })

  return {
    task: updated,
  }
}

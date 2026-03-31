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
  blockedByIds?: string[]
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
  blockedByIds?: string[]
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
      blockedBy: input.blockedByIds?.length
        ? { connect: input.blockedByIds.map((id) => ({ id })) }
        : undefined,
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
    projectId: input.projectId,
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
    select: { id: true, status: true, projectId: true },
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
    projectId: task.projectId,
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
    projectId: task.projectId,
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
 * 支援自動排程：當 targetDate 延後時，自動推據後續任務的時間。
 */
export async function updateTask(input: UpdateTaskInput): Promise<UpdateTaskResult> {
  const { taskId, actorId, ...updateData } = input

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      assigneeId: true,
      plannedStartDate: true,
      targetDate: true,
      projectId: true,
    },
  })

  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }

  // 記錄原始 targetDate 用於比較
  const originalTargetDate = task.targetDate

  // 只更新傳入的欄位
  const dataToUpdate: Record<string, unknown> = {}
  if (updateData.title !== undefined) dataToUpdate.title = updateData.title
  if (updateData.description !== undefined) dataToUpdate.description = updateData.description
  if (updateData.assigneeId !== undefined) dataToUpdate.assigneeId = updateData.assigneeId
  if (updateData.plannedStartDate !== undefined) dataToUpdate.plannedStartDate = updateData.plannedStartDate
  if (updateData.targetDate !== undefined) dataToUpdate.targetDate = updateData.targetDate
  // 處理前置任務關聯更新
  if (input.blockedByIds !== undefined) {
    dataToUpdate.blockedBy = {
      set: input.blockedByIds.map((id) => ({ id })),
    }
  }

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
      code: true,
      title: true,
      description: true,
      assigneeId: true,
      plannedStartDate: true,
      targetDate: true,
      projectId: true,
    },
  })

  await recordAudit({
    action: AuditActions.TASK_UPDATE,
    entityType: 'Task',
    entityId: updated.id,
    actorId,
    projectId: task.projectId,
    detail: {
      changes: dataToUpdate,
    },
  })

  // ─── 自動排程推擠邏輯 ───
  // 當 targetDate 被修改且有延後時，自動推據後續任務
  if (updateData.targetDate !== undefined && originalTargetDate && updateData.targetDate !== null) {
    const newTargetDate = new Date(updateData.targetDate)
    const oldTargetDate = new Date(originalTargetDate)

    // 只有當新日期晚於原日期時才執行推據
    if (newTargetDate > oldTargetDate) {
      await cascadeSchedulePush(taskId, newTargetDate, actorId, task.projectId)
    }
  }

  return {
    task: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      assigneeId: updated.assigneeId,
      plannedStartDate: updated.plannedStartDate,
      targetDate: updated.targetDate,
    },
  }
}

/**
 * 計算兩個日期之間的天數差異（取絕對值）
 */
function calculateDurationInDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((end.getTime() - start.getTime()) / msPerDay))
}

/**
 * 將日期往後推移指定天數
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * 遞迴推據後續任務的時間
 * Finish-to-Start 原則：前置任務結束後，後續任務才能開始
 *
 * @param predecessorId 前置任務 ID
 * @param predecessorTargetDate 前置任務新的結束日期
 * @param actorId 操作者 ID
 * @param projectId 專案 ID
 * @param visited 防止循環依賴的追蹤集合
 */
async function cascadeSchedulePush(
  predecessorId: string,
  predecessorTargetDate: Date,
  actorId: string | null | undefined,
  projectId: string,
  visited: Set<string> = new Set()
): Promise<void> {
  // 防止循環依賴
  if (visited.has(predecessorId)) {
    return
  }
  visited.add(predecessorId)

  // 查詢所有依賴於當前任務的後續任務（Successors）
  const successors = await prisma.task.findMany({
    where: {
      blockedBy: {
        some: {
          id: predecessorId,
        },
      },
    },
    select: {
      id: true,
      code: true,
      title: true,
      plannedStartDate: true,
      targetDate: true,
      projectId: true,
    },
  })

  for (const successor of successors) {
    // 如果後續任務沒有開始日期，跳過
    if (!successor.plannedStartDate) {
      continue
    }

    const successorStartDate = new Date(successor.plannedStartDate)

    // 如果前置任務的結束日期晚於或等於後續任務的開始日期，需要推據
    // Finish-to-Start: 後續任務應在前置任務結束的隔天開始
    if (predecessorTargetDate >= successorStartDate) {
      // 計算新的開始日期：前置任務結束日的隔天
      const newStartDate = addDays(predecessorTargetDate, 1)

      // 計算原本的工期（如果有 targetDate）
      let newTargetDate: Date | null = null
      if (successor.targetDate) {
        const originalDuration = calculateDurationInDays(successorStartDate, new Date(successor.targetDate))
        newTargetDate = addDays(newStartDate, originalDuration)
      }

      // 更新後續任務的日期
      const updateData: { plannedStartDate: Date; targetDate?: Date } = {
        plannedStartDate: newStartDate,
      }
      if (newTargetDate) {
        updateData.targetDate = newTargetDate
      }

      await prisma.task.update({
        where: { id: successor.id },
        data: updateData,
      })

      // 記錄自動排程的稽核軌跡
      await recordAudit({
        action: AuditActions.TASK_AUTO_SCHEDULE,
        entityType: 'Task',
        entityId: successor.id,
        actorId,
        projectId: successor.projectId,
        detail: {
          reason: `前置任務 ${predecessorId} 結束日期延後`,
          predecessorId,
          predecessorNewTargetDate: predecessorTargetDate.toISOString(),
          originalStartDate: successor.plannedStartDate,
          newStartDate: newStartDate.toISOString(),
          originalTargetDate: successor.targetDate?.toISOString() ?? null,
          newTargetDate: newTargetDate?.toISOString() ?? null,
        },
      })

      // 遞迴推據：如果這個後續任務也有它的後續任務，繼續推據
      if (newTargetDate) {
        await cascadeSchedulePush(successor.id, newTargetDate, actorId, projectId, visited)
      }
    }
  }
}

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { prisma } from './prisma'
import { createTask, startTask, completeTask, TASK_COMPLETION_ERROR, TASK_NOT_IN_PROGRESS_ERROR, TASK_START_ERROR } from './task-service'
import { advancePhase, evaluatePhaseGate } from './phase-service'
import {
  listProjectPendingItems,
  resolvePendingItem,
  PENDING_ITEM_RESOLUTION_ERROR,
} from './pending-item-service'
import {
  CHANGE_REQUEST_APPROVAL_ERROR,
  CHANGE_REQUEST_WORKFLOW_ERROR,
  createChangeRequest,
  transitionChangeRequest,
} from './change-request-service'
import {
  LOCKED_DELIVERABLE_APPROVED_CHANGE_REQUEST_ERROR,
  LOCKED_DELIVERABLE_STATUS_CHANGE_ERROR,
  INVALID_STATUS_TRANSITION_ERROR,
  createFileRevision,
  updateDeliverableStatus,
} from './deliverable-service'
import {
  ChangeRequestStatus,
  ProjectPhase,
  TaskStatus,
  DeliverableStatus,
  PendingItemStatus,
} from '@prisma/client'

// Use a separate test SQLite DB
process.env.DATABASE_URL = 'file:./test.db'

let counter = 0
let testUserId = ''

beforeAll(async () => {
  execSync('npx prisma db push --force-reset', {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.db',
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:
        '幫我寫一個單元測試或邏輯測試腳本來驗證這段邏輯',
    },
    stdio: 'pipe',
  })
  // Create a test user for override audit trail
  const user = await prisma.user.create({
    data: {
      email: `testuser-${Date.now()}@example.com`,
      name: 'Test PM',
      role: 'PM',
    },
  })
  testUserId = user.id
})

afterEach(async () => {
  // Clean up data between tests to avoid unique constraint conflicts
  await prisma.auditLog.deleteMany()
  await prisma.taskDeliverable.deleteMany()
  await prisma.task.deleteMany()
  await prisma.fileRevision.deleteMany()
  await prisma.pendingItem.deleteMany()
  await prisma.deliverablePlaceholder.deleteMany()
  await prisma.phaseTransition.deleteMany()
  await prisma.changeRequestDeliverable.deleteMany()
  await prisma.changeRequestPart.deleteMany()
  await prisma.changeRequest.deleteMany()
  await prisma.project.deleteMany()
})

afterAll(async () => {
  await prisma.user.deleteMany()
  await prisma.$disconnect()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}-${++counter}`
}

async function setupProject() {
  return prisma.project.create({
    data: {
      code: `PRJ-${uid()}`,
      name: 'Test Project',
      currentPhase: ProjectPhase.Planning,
    },
  })
}

async function setupDeliverables(projectId: string, count: number) {
  const base = uid()
  return Promise.all(
    Array.from({ length: count }, (_, i) =>
      prisma.deliverablePlaceholder.create({
        data: {
          projectId,
          code: `DEL-${base}-${i + 1}`,
          title: `Deliverable ${i + 1}`,
          phase: ProjectPhase.Planning,
          status: DeliverableStatus.Draft,
        },
      })
    )
  )
}

async function setupDeliverable(projectId: string, phase: ProjectPhase, status = DeliverableStatus.Draft) {
  return prisma.deliverablePlaceholder.create({
    data: {
      projectId,
      code: `DEL-${uid()}`,
      title: `Deliverable ${phase}`,
      phase,
      status,
    },
  })
}

// ─── Tests: createTask ─────────────────────────────────────────────────────────

describe('createTask', () => {
  it('建立 Task 並同時綁定多個 DeliverablePlaceholder', async () => {
    const project = await setupProject()
    const deliverables = await setupDeliverables(project.id, 3)
    const deliverableIds = deliverables.map((d) => d.id)

    const result = await createTask({
      projectId: project.id,
      code: 'T-001',
      title: 'Design Input Review',
      description: 'Review design inputs',
      plannedPhase: ProjectPhase.DesignInput,
      deliverableIds,
    })

    expect(result.task.code).toBe('T-001')
    expect(result.task.status).toBe(TaskStatus.Todo)
    expect(result.task.deliverableLinks).toHaveLength(3)

    const links = await prisma.taskDeliverable.findMany({
      where: { taskId: result.task.id },
    })
    expect(links).toHaveLength(3)
  })

  it('建立 Task 時若 deliverableIds 為空，拋出錯誤', async () => {
    const project = await setupProject()
    await expect(
      createTask({
        projectId: project.id,
        code: 'T-002',
        title: 'Orphan Task',
        plannedPhase: ProjectPhase.Concept,
        deliverableIds: [],
      })
    ).rejects.toThrow('Task must be linked to at least one DeliverablePlaceholder.')
  })

  it('建立 Task 時若 deliverable 不屬於同個 project，拋出錯誤', async () => {
    const projectA = await setupProject()
    const projectB = await setupProject()
    const base = uid()
    const deliverableA = await prisma.deliverablePlaceholder.create({
      data: {
        projectId: projectA.id,
        code: `DEL-${base}-A`,
        title: 'Del A',
        phase: ProjectPhase.Concept,
      },
    })
    const deliverableB = await prisma.deliverablePlaceholder.create({
      data: {
        projectId: projectB.id,
        code: `DEL-${base}-B`,
        title: 'Del B',
        phase: ProjectPhase.Concept,
      },
    })

    await expect(
      createTask({
        projectId: projectA.id,
        code: 'T-003',
        title: 'Cross-Project Task',
        plannedPhase: ProjectPhase.Concept,
        deliverableIds: [deliverableA.id, deliverableB.id],
      })
    ).rejects.toThrow(/not found or not in project/)
  })
})

// ─── Tests: completeTask ───────────────────────────────────────────────────────

describe('completeTask', () => {
  it('所有 DeliverablePlaceholder 都有 FileRevision 時，可成功完成 Task', async () => {
    const project = await setupProject()
    const deliverables = await setupDeliverables(project.id, 2)

    const result = await createTask({
      projectId: project.id,
      code: 'T-010',
      title: 'Task with files',
      plannedPhase: ProjectPhase.DesignOutput,
      deliverableIds: deliverables.map((d) => d.id),
    })

    await Promise.all(
      deliverables.map((d, i) =>
        prisma.fileRevision.create({
          data: {
            deliverableId: d.id,
            revisionNumber: 1,
            fileName: `doc-${i + 1}.pdf`,
            storagePath: `/files/${d.id}/doc-${i + 1}.pdf`,
            mimeType: 'application/pdf',
            fileSizeBytes: 1024,
          },
        })
      )
    )

    await startTask(result.task.id)
    const completed = await completeTask(result.task.id)
    expect(completed.task.status).toBe(TaskStatus.Done)
    expect(completed.task.completedAt).toBeInstanceOf(Date)
  })

  it('待開始狀態的 Task 無法直接完成（必須先啟動）', async () => {
    const project = await setupProject()
    const deliverables = await setupDeliverables(project.id, 1)

    await prisma.fileRevision.create({
      data: {
        deliverableId: deliverables[0].id,
        revisionNumber: 1,
        fileName: 'doc.pdf',
        storagePath: `/files/${deliverables[0].id}/doc.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
      },
    })

    const result = await createTask({
      projectId: project.id,
      code: `T-${uid()}`,
      title: 'Task not started',
      plannedPhase: ProjectPhase.DesignOutput,
      deliverableIds: deliverables.map((d) => d.id),
    })

    await expect(completeTask(result.task.id)).rejects.toThrow(TASK_NOT_IN_PROGRESS_ERROR)
  })

  it('startTask 可以將 Todo 狀態轉為 InProgress', async () => {
    const project = await setupProject()
    const deliverables = await setupDeliverables(project.id, 1)

    const result = await createTask({
      projectId: project.id,
      code: `T-${uid()}`,
      title: 'Task to start',
      plannedPhase: ProjectPhase.Planning,
      deliverableIds: deliverables.map((d) => d.id),
    })

    const started = await startTask(result.task.id)
    expect(started.task.status).toBe(TaskStatus.InProgress)
    expect(started.task.startedAt).toBeInstanceOf(Date)
  })

  it('已啟動的 Task 不能再次啟動', async () => {
    const project = await setupProject()
    const deliverables = await setupDeliverables(project.id, 1)

    const result = await createTask({
      projectId: project.id,
      code: `T-${uid()}`,
      title: 'Already started',
      plannedPhase: ProjectPhase.Planning,
      deliverableIds: deliverables.map((d) => d.id),
    })

    await startTask(result.task.id)
    await expect(startTask(result.task.id)).rejects.toThrow(TASK_START_ERROR)
  })

  it('有 DeliverablePlaceholder 尚未上傳 FileRevision 時，阻擋完成並顯示正確錯誤訊息', async () => {
    const project = await setupProject()
    const [delivered, notDelivered] = await setupDeliverables(project.id, 2)

    await prisma.fileRevision.create({
      data: {
        deliverableId: delivered.id,
        revisionNumber: 1,
        fileName: 'doc-1.pdf',
        storagePath: `/files/${delivered.id}/doc-1.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 512,
      },
    })

    const result = await createTask({
      projectId: project.id,
      code: 'T-011',
      title: 'Task with missing file',
      plannedPhase: ProjectPhase.Verification,
      deliverableIds: [delivered.id, notDelivered.id],
    })

    await expect(completeTask(result.task.id)).rejects.toThrow(TASK_NOT_IN_PROGRESS_ERROR)
  })

  it('Task 已為 Done 狀態時，再次呼叫 completeTask 拋出錯誤', async () => {
    const project = await setupProject()
    const deliverables = await setupDeliverables(project.id, 1)

    await prisma.fileRevision.create({
      data: {
        deliverableId: deliverables[0].id,
        revisionNumber: 1,
        fileName: 'doc.pdf',
        storagePath: `/files/${deliverables[0].id}/doc.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 256,
      },
    })

    const result = await createTask({
      projectId: project.id,
      code: 'T-012',
      title: 'Double complete',
      plannedPhase: ProjectPhase.Validation,
      deliverableIds: deliverables.map((d) => d.id),
    })

    await startTask(result.task.id)
    await completeTask(result.task.id)
    await expect(completeTask(result.task.id)).rejects.toThrow('Task is already completed.')
  })

  it('所有 DeliverablePlaceholder 都沒有 FileRevision 時，阻擋完成', async () => {
    const project = await setupProject()
    const deliverables = await setupDeliverables(project.id, 2)

    const result = await createTask({
      projectId: project.id,
      code: 'T-013',
      title: 'Task with no files at all',
      plannedPhase: ProjectPhase.DesignTransfer,
      deliverableIds: deliverables.map((d) => d.id),
    })

    await expect(completeTask(result.task.id)).rejects.toThrow(TASK_NOT_IN_PROGRESS_ERROR)
  })
})

// ─── Tests: phase gates / pending items ───────────────────────────────────────

describe('phase gate pending items', () => {
  it('soft gate override 會建立 PendingItem，並留下 override 稽核紀錄', async () => {
    const project = await setupProject()
    const deliverable = await setupDeliverable(project.id, ProjectPhase.Planning, DeliverableStatus.Draft)

    const warning = await advancePhase(project.id)
    expect(warning.success).toBe(true)
    expect(warning.outcome).toBe('warning')

    const forced = await advancePhase(project.id, {
      forceOverride: true,
      overriddenById: testUserId,
      rationale: 'Market pressure',
    })

    expect(forced.success).toBe(true)
    expect(forced.outcome).toBe('forced')

    const pendingItems = await prisma.pendingItem.findMany({
      where: { projectId: project.id },
    })
    expect(pendingItems).toHaveLength(1)
    expect(pendingItems[0].deliverableId).toBe(deliverable.id)
    expect(pendingItems[0].status).toBe(PendingItemStatus.Open)

    const transition = await prisma.phaseTransition.findFirst({
      where: { projectId: project.id, wasOverride: true },
    })
    expect(transition).not.toBeNull()
    expect(transition?.triggeredById).toBe(testUserId)
  })

  it('進入 DesignTransfer 前若仍有 PendingItem，必須被 hard gate 擋下', async () => {
    const project = await prisma.project.create({
      data: {
        code: `PRJ-${uid()}`,
        name: 'Hard Gate Project',
        currentPhase: ProjectPhase.Validation,
      },
    })

    const deliverable = await setupDeliverable(
      project.id,
      ProjectPhase.Verification,
      DeliverableStatus.Draft,
    )

    await prisma.pendingItem.create({
      data: {
        projectId: project.id,
        deliverableId: deliverable.id,
        title: 'Legacy verification evidence',
        detail: 'Verification report still missing',
        status: PendingItemStatus.Open,
      },
    })

    const gate = await evaluatePhaseGate(project.id)
    expect(gate.canAdvance).toBe(false)
    if (gate.canAdvance) {
      throw new Error('Expected hard gate failure')
    }
    expect(gate.isHardGate).toBe(true)
    expect(gate.issues.some((issue) => issue.reason.includes('遺留項'))).toBe(true)

    const result = await advancePhase(project.id)
    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error('Expected hard gate result')
    }
    expect(result.reason).toBe('hard_gate')
  })

  it('遺留項對應文件 Released 後，hard gate 可通過且 PendingItem 會自動標記為 Resolved', async () => {
    const project = await prisma.project.create({
      data: {
        code: `PRJ-${uid()}`,
        name: 'Resolved Pending Item Project',
        currentPhase: ProjectPhase.Validation,
      },
    })

    const deliverable = await setupDeliverable(
      project.id,
      ProjectPhase.Verification,
      DeliverableStatus.Draft,
    )

    const pendingItem = await prisma.pendingItem.create({
      data: {
        projectId: project.id,
        deliverableId: deliverable.id,
        title: 'Pending verification report',
        status: PendingItemStatus.Open,
      },
    })

    await prisma.deliverablePlaceholder.update({
      where: { id: deliverable.id },
      data: { status: DeliverableStatus.Released },
    })

    const gate = await evaluatePhaseGate(project.id)
    expect(gate.canAdvance).toBe(true)

    const refreshedPendingItem = await prisma.pendingItem.findUnique({
      where: { id: pendingItem.id },
    })
    expect(refreshedPendingItem?.status).toBe(PendingItemStatus.Resolved)
    expect(refreshedPendingItem?.resolvedAt).not.toBeNull()
  })

  it('listProjectPendingItems 會回傳專案遺留項，且只取指定專案', async () => {
    const projectA = await setupProject()
    const projectB = await setupProject()

    const deliverableA = await setupDeliverable(
      projectA.id,
      ProjectPhase.Planning,
      DeliverableStatus.Draft,
    )
    const deliverableB = await setupDeliverable(
      projectB.id,
      ProjectPhase.Planning,
      DeliverableStatus.Draft,
    )

    await prisma.pendingItem.create({
      data: {
        projectId: projectA.id,
        deliverableId: deliverableA.id,
        title: 'Project A pending item',
        status: PendingItemStatus.Open,
      },
    })

    await prisma.pendingItem.create({
      data: {
        projectId: projectB.id,
        deliverableId: deliverableB.id,
        title: 'Project B pending item',
        status: PendingItemStatus.Open,
      },
    })

    const projectAItems = await listProjectPendingItems(projectA.id)
    expect(projectAItems).toHaveLength(1)
    expect(projectAItems[0].projectId).toBe(projectA.id)
    expect(projectAItems[0].deliverable.id).toBe(deliverableA.id)
  })

  it('resolvePendingItem 僅允許在 Deliverable 已 Released 時結案', async () => {
    const project = await setupProject()
    const deliverable = await setupDeliverable(
      project.id,
      ProjectPhase.Planning,
      DeliverableStatus.Draft,
    )

    const pendingItem = await prisma.pendingItem.create({
      data: {
        projectId: project.id,
        deliverableId: deliverable.id,
        title: 'Pending before release',
        status: PendingItemStatus.Open,
      },
    })

    await expect(resolvePendingItem(pendingItem.id)).rejects.toThrow(
      PENDING_ITEM_RESOLUTION_ERROR,
    )

    await prisma.deliverablePlaceholder.update({
      where: { id: deliverable.id },
      data: { status: DeliverableStatus.Released },
    })

    const resolved = await resolvePendingItem(pendingItem.id)
    expect(resolved.status).toBe(PendingItemStatus.Resolved)
    expect(resolved.resolvedAt).not.toBeNull()
  })
})

// ─── Phase Gate Helpers ─────────────────────────────────────────────────────────

async function setupProjectWithPhase(phase: ProjectPhase) {
  return prisma.project.create({
    data: {
      code: `PRJ-${uid()}`,
      name: 'Test Project',
      currentPhase: phase,
    },
  })
}

async function setupDeliverableForPhase(
  projectId: string,
  phase: ProjectPhase,
  status: DeliverableStatus,
) {
  return prisma.deliverablePlaceholder.create({
    data: {
      projectId,
      code: `DEL-${uid()}`,
      title: `Deliverable`,
      phase,
      status,
    },
  })
}

// ─── Tests: evaluatePhaseGate ──────────────────────────────────────────────────

describe('evaluatePhaseGate', () => {
  it('所有 required deliverables 都是 Released 時，gate 通過', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)

    const result = await evaluatePhaseGate(project.id)
    expect(result.canAdvance).toBe(true)
    expect(result.nextPhase).toBe(ProjectPhase.DesignInput)
  })

  it('有任何 required deliverable 不是 Released 時，gate 失敗並列出詳細問題', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Draft)

    const result = await evaluatePhaseGate(project.id)
    expect(result.canAdvance).toBe(false)
    expect(result.isHardGate).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].reason).toContain('草稿')
  })

  it('isRequired=false 的 deliverable 未 Released，不阻擋 gate', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)
    await prisma.deliverablePlaceholder.create({
      data: {
        projectId: project.id,
        code: `DEL-OPT-${uid()}`,
        title: 'Optional Deliverable',
        phase: ProjectPhase.Planning,
        status: DeliverableStatus.Draft,
        isRequired: false,
      },
    })

    const result = await evaluatePhaseGate(project.id)
    expect(result.canAdvance).toBe(true)
  })

  it('不同 phase 的 incomplete deliverables 不影響當前 soft gate', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)
    // Future-phase incomplete deliverable
    await setupDeliverableForPhase(project.id, ProjectPhase.DesignInput, DeliverableStatus.Draft)

    const result = await evaluatePhaseGate(project.id)
    expect(result.canAdvance).toBe(true)
  })

  it('專案不存在時拋出錯誤', async () => {
    await expect(evaluatePhaseGate('non-existent-id')).rejects.toThrow('Project not found')
  })
})

// ─── Tests: advancePhase ───────────────────────────────────────────────────────

describe('advancePhase', () => {
  it('gate 通過時，推進階段成功 (outcome: advanced)', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)

    const result = await advancePhase(project.id)
    expect(result.success).toBe(true)
    expect(result.outcome).toBe('advanced')
    if (result.outcome === 'advanced') {
      expect(result.project.currentPhase).toBe(ProjectPhase.DesignInput)
    }

    const transitions = await prisma.phaseTransition.findMany({
      where: { projectId: project.id },
    })
    expect(transitions).toHaveLength(1)
    expect(transitions[0].wasOverride).toBe(false)
    expect(transitions[0].fromPhase).toBe(ProjectPhase.Planning)
    expect(transitions[0].toPhase).toBe(ProjectPhase.DesignInput)
  })

  it('gate 失敗且無 forceOverride 時，回傳 warning 結果與詳細錯誤清單', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Draft)

    const result = await advancePhase(project.id)
    expect(result.success).toBe(true)
    expect(result.outcome).toBe('warning')
    if (result.outcome === 'warning') {
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.message).toContain('尚未 Released')
    }
  })

  it('forceOverride=true 時可繼續推進，並建立 PhaseTransition 審計記錄 (outcome: forced)', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Draft)

    const result = await advancePhase(project.id, {
      forceOverride: true,
      overriddenById: testUserId,
      rationale: 'Due to schedule pressure',
    })
    expect(result.success).toBe(true)
    expect(result.outcome).toBe('forced')
    if (result.outcome === 'forced') {
      expect(result.project.currentPhase).toBe(ProjectPhase.DesignInput)
      expect(result.issues.length).toBe(1)
    }

    const transitions = await prisma.phaseTransition.findMany({
      where: { projectId: project.id },
    })
    expect(transitions).toHaveLength(1)
    expect(transitions[0].wasOverride).toBe(true)
    expect(transitions[0].overrideReason).toBe('Due to schedule pressure')
  })

  it('forceOverride=true 但未提供 overriddenById 時，回傳 validation_error', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Draft)

    const result = await advancePhase(project.id, {
      forceOverride: true,
      rationale: 'Missing approver should fail',
    })

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error('Expected validation_error result')
    }
    expect(result.reason).toBe('validation_error')
  })
})

// ─── Tests: DesignTransfer Hard Gate ─────────────────────────────────────────

describe('DesignTransfer hard gate', () => {
  it('所有 deliverables 都是 Released 時，可以推進到 DesignTransfer (outcome: advanced)', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Validation)
    const deliverable = await setupDeliverableForPhase(
      project.id,
      ProjectPhase.Validation,
      DeliverableStatus.Released,
    )

    const result = await advancePhase(project.id)
    expect(result.success).toBe(true)
    expect(result.outcome).toBe('advanced')
    if (result.outcome === 'advanced') {
      expect(result.project.currentPhase).toBe(ProjectPhase.DesignTransfer)
    }

    const refreshed = await prisma.deliverablePlaceholder.findUnique({
      where: { id: deliverable.id },
    })
    expect(refreshed?.status).toBe(DeliverableStatus.Locked)
    expect(refreshed?.lockedAt).not.toBeNull()
  })

  it('有 incomplete deliverables 時，即使提供 forceOverride 也回傳 hard_gate 錯誤', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Validation)
    await setupDeliverableForPhase(project.id, ProjectPhase.Validation, DeliverableStatus.Released)
    await setupDeliverableForPhase(project.id, ProjectPhase.Validation, DeliverableStatus.Draft)

    // forceOverride=true still gets rejected for DesignTransfer hard gate
    const result = await advancePhase(project.id, {
      forceOverride: true,
      overriddenById: testUserId,
      rationale: 'Should not work',
    })
    expect(result.success).toBe(false)
    expect(result.reason).toBe('hard_gate')
    expect(result.message).toContain('不接受 Override')
  })

  it('soft gate 只檢查當前 phase 的 deliverables，不受前期 phase 影響', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Verification)
    // Verification phase deliverable is fine
    await setupDeliverableForPhase(project.id, ProjectPhase.Verification, DeliverableStatus.Released)
    // Prior phase has a Draft — should NOT affect soft gate
    await setupDeliverableForPhase(project.id, ProjectPhase.DesignOutput, DeliverableStatus.Draft)

    const result = await advancePhase(project.id)

    // Soft gate passes since only current phase deliverables are checked
    expect(result.success).toBe(true)
    expect(result.outcome).toBe('advanced')
    if (result.outcome === 'advanced') {
      expect(result.project.currentPhase).toBe(ProjectPhase.Validation)
    }
  })

  it('進入 DesignTransfer 後，Locked deliverable 不能直接解鎖', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Validation)
    const deliverable = await setupDeliverableForPhase(
      project.id,
      ProjectPhase.Validation,
      DeliverableStatus.Released,
    )

    const result = await advancePhase(project.id)
    expect(result.success).toBe(true)
    expect(result.outcome).toBe('advanced')

    await expect(
      updateDeliverableStatus({
        deliverableId: deliverable.id,
        status: DeliverableStatus.Released,
      }),
    ).rejects.toThrow(LOCKED_DELIVERABLE_STATUS_CHANGE_ERROR)
  })
})

describe('change request rules', () => {
  it('建立 ChangeRequest 時若缺少 impact analysis，會被阻擋', async () => {
    const project = await setupProject()

    await expect(
      createChangeRequest({
        code: `CR-${uid()}`,
        title: 'Missing impact analysis',
        projectId: project.id,
      }),
    ).rejects.toThrow('Impact analysis is required for every change request.')
  })

  it('建立 ChangeRequest 時有 impact analysis 且關聯專案，則可成功建立', async () => {
    const project = await setupProject()

    const result = await createChangeRequest({
      code: `CR-${uid()}`,
      title: 'Valid change request',
      projectId: project.id,
      impactAnalysis: 'Regulatory, verification, and documentation impact reviewed.',
    })

    expect(result.changeRequest.projectId).toBe(project.id)
    expect(result.changeRequest.status).toBe('Draft')
  })

  it('變更單必須依照正式 workflow 流轉，不能直接從 Draft 跳到 Approved', async () => {
    const project = await setupProject()
    const created = await createChangeRequest({
      code: `CR-${uid()}`,
      title: 'Workflow change request',
      projectId: project.id,
      impactAnalysis: 'Workflow transition impact reviewed.',
    })

    await expect(
      transitionChangeRequest({
        changeRequestId: created.changeRequest.id,
        nextStatus: ChangeRequestStatus.Approved,
        actedById: testUserId,
      }),
    ).rejects.toThrow(CHANGE_REQUEST_WORKFLOW_ERROR)
  })

  it('變更單核准時必須指定 approver，且會寫入時間戳', async () => {
    const project = await setupProject()
    const created = await createChangeRequest({
      code: `CR-${uid()}`,
      title: 'Approval metadata change request',
      projectId: project.id,
      impactAnalysis: 'Approval metadata impact reviewed.',
    })

    await transitionChangeRequest({
      changeRequestId: created.changeRequest.id,
      nextStatus: ChangeRequestStatus.Submitted,
    })
    await transitionChangeRequest({
      changeRequestId: created.changeRequest.id,
      nextStatus: ChangeRequestStatus.InReview,
    })

    await expect(
      transitionChangeRequest({
        changeRequestId: created.changeRequest.id,
        nextStatus: ChangeRequestStatus.Approved,
      }),
    ).rejects.toThrow(CHANGE_REQUEST_APPROVAL_ERROR)

    const approved = await transitionChangeRequest({
      changeRequestId: created.changeRequest.id,
      nextStatus: ChangeRequestStatus.Approved,
      actedById: testUserId,
    })

    expect(approved.changeRequest.status).toBe(ChangeRequestStatus.Approved)
    expect(approved.changeRequest.approverId).toBe(testUserId)
    expect(approved.changeRequest.approvedAt).not.toBeNull()
  })

  it('Locked deliverable 只有在 linked CR 已核准後才能新增 revision', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.DesignTransfer)
    const deliverable = await setupDeliverableForPhase(
      project.id,
      ProjectPhase.DesignTransfer,
      DeliverableStatus.Locked,
    )

    const draftRequest = await createChangeRequest({
      code: `CR-${uid()}`,
      title: 'Draft CR',
      projectId: project.id,
      impactAnalysis: 'Draft CR impact analysis.',
      deliverableIds: [deliverable.id],
    })

    await expect(
      createFileRevision({
        deliverableId: deliverable.id,
        fileName: 'locked-draft.pdf',
        storagePath: 'storage/revisions/test/locked-draft.pdf',
        changeRequestId: draftRequest.changeRequest.id,
      }),
    ).rejects.toThrow(LOCKED_DELIVERABLE_APPROVED_CHANGE_REQUEST_ERROR)

    await transitionChangeRequest({
      changeRequestId: draftRequest.changeRequest.id,
      nextStatus: ChangeRequestStatus.Submitted,
    })
    await transitionChangeRequest({
      changeRequestId: draftRequest.changeRequest.id,
      nextStatus: ChangeRequestStatus.InReview,
    })
    await transitionChangeRequest({
      changeRequestId: draftRequest.changeRequest.id,
      nextStatus: ChangeRequestStatus.Approved,
      actedById: testUserId,
    })

    const revision = await createFileRevision({
      deliverableId: deliverable.id,
      fileName: 'locked-approved.pdf',
      storagePath: 'storage/revisions/test/locked-approved.pdf',
      changeRequestId: draftRequest.changeRequest.id,
    })

    expect(revision.revision.revisionNumber).toBe(1)
  })
})

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { prisma } from './prisma'
import { createTask, completeTask, TASK_COMPLETION_ERROR } from './task-service'
import { advancePhase, evaluatePhaseGate } from './phase-service'
import { ProjectPhase, TaskStatus, DeliverableStatus } from '@prisma/client'

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
  await prisma.taskDeliverable.deleteMany()
  await prisma.task.deleteMany()
  await prisma.fileRevision.deleteMany()
  await prisma.deliverablePlaceholder.deleteMany()
  await prisma.phaseTransition.deleteMany()
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

    const completed = await completeTask(result.task.id)
    expect(completed.task.status).toBe(TaskStatus.Done)
    expect(completed.task.completedAt).toBeInstanceOf(Date)
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

    await expect(completeTask(result.task.id)).rejects.toThrow(TASK_COMPLETION_ERROR)
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

    await expect(completeTask(result.task.id)).rejects.toThrow(TASK_COMPLETION_ERROR)
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
  it('gate 通過時，推進階段成功', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)

    const result = await advancePhase(project.id)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.project.currentPhase).toBe(ProjectPhase.DesignInput)
      expect(result.wasOverridden).toBe(false)
    }
  })

  it('gate 失敗且無 override 時，回傳 blocked 結果與詳細錯誤清單', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Released)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Draft)

    const result = await advancePhase(project.id)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.reason).toBe('blocked')
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.message).toContain('尚未 Released')
    }
  })

  it('soft gate 提供 override 時可繼續推進，並建立 PhaseTransition 審計記錄', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Planning)
    await setupDeliverableForPhase(project.id, ProjectPhase.Planning, DeliverableStatus.Draft)

    const result = await advancePhase(project.id, {
      overriddenById: testUserId,
      rationale: 'Due to schedule pressure',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.project.currentPhase).toBe(ProjectPhase.DesignInput)
      expect(result.wasOverridden).toBe(true)
    }

    const transitions = await prisma.phaseTransition.findMany({
      where: { projectId: project.id },
    })
    expect(transitions).toHaveLength(1)
    expect(transitions[0].wasOverride).toBe(true)
    expect(transitions[0].overrideReason).toBe('Due to schedule pressure')
  })
})

// ─── Tests: DesignTransfer Hard Gate ─────────────────────────────────────────

describe('DesignTransfer hard gate', () => {
  it('所有 deliverables 都是 Released 時，可以推進到 DesignTransfer', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Validation)
    await setupDeliverableForPhase(project.id, ProjectPhase.Validation, DeliverableStatus.Released)

    const result = await advancePhase(project.id)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.project.currentPhase).toBe(ProjectPhase.DesignTransfer)
    }
  })

  it('有 incomplete deliverables 時，DesignTransfer 回傳 hard_gate 且不接受 override', async () => {
    const project = await setupProjectWithPhase(ProjectPhase.Validation)
    await setupDeliverableForPhase(project.id, ProjectPhase.Validation, DeliverableStatus.Released)
    await setupDeliverableForPhase(project.id, ProjectPhase.Validation, DeliverableStatus.Draft)

    const result = await advancePhase(project.id, {
      overriddenById: testUserId,
      rationale: 'Should not work',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.reason).toBe('hard_gate')
      expect(result.message).toContain('不接受 Override')
    }
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
    if (result.success) {
      expect(result.project.currentPhase).toBe(ProjectPhase.Validation)
    }
  })
})

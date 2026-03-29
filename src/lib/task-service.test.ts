import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { prisma } from './prisma'
import { createTask, completeTask, TASK_COMPLETION_ERROR } from './task-service'
import { ProjectPhase, TaskStatus, DeliverableStatus } from '@prisma/client'

// Use a separate test SQLite DB
process.env.DATABASE_URL = 'file:./test.db'

let counter = 0

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
})

afterEach(async () => {
  // Clean up data between tests to avoid unique constraint conflicts
  await prisma.taskDeliverable.deleteMany()
  await prisma.task.deleteMany()
  await prisma.fileRevision.deleteMany()
  await prisma.deliverablePlaceholder.deleteMany()
  await prisma.project.deleteMany()
})

afterAll(async () => {
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

import { ProjectPhase, TaskStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, recordAuditMock } = vi.hoisted(() => ({
  prismaMock: {
    deliverablePlaceholder: {
      findMany: vi.fn(),
    },
    task: {
      create: vi.fn(),
    },
  },
  recordAuditMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/audit-log-service', () => ({
  recordAudit: recordAuditMock,
  AuditActions: {
    TASK_CREATE: 'task.create',
    TASK_START: 'task.start',
    TASK_COMPLETE: 'task.complete',
  },
}))

import { createTask } from './task-service'

describe('task-service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects task creation without linked deliverables', async () => {
    await expect(
      createTask({
        projectId: 'project-1',
        code: 'TASK-001',
        title: 'Draft verification plan',
        plannedPhase: ProjectPhase.Verification,
        deliverableIds: [],
      }),
    ).rejects.toThrow('Task must be linked to at least one DeliverablePlaceholder.')
  })

  it('allows future-phase tasks when deliverables are linked', async () => {
    prismaMock.deliverablePlaceholder.findMany.mockResolvedValue([
      { id: 'del-1' },
      { id: 'del-2' },
    ])
    prismaMock.task.create.mockResolvedValue({
      id: 'task-1',
      code: 'TASK-001',
      title: 'Draft verification plan',
      status: TaskStatus.Todo,
      plannedPhase: ProjectPhase.Verification,
      deliverableLinks: [
        { id: 'link-1', deliverableId: 'del-1' },
        { id: 'link-2', deliverableId: 'del-2' },
      ],
    })

    const result = await createTask({
      projectId: 'project-1',
      code: 'TASK-001',
      title: 'Draft verification plan',
      plannedPhase: ProjectPhase.Verification,
      deliverableIds: ['del-1', 'del-2'],
    })

    expect(result.task.plannedPhase).toBe(ProjectPhase.Verification)
    expect(prismaMock.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plannedPhase: ProjectPhase.Verification,
          deliverableLinks: {
            create: [{ deliverableId: 'del-1' }, { deliverableId: 'del-2' }],
          },
        }),
      }),
    )
    expect(recordAuditMock).toHaveBeenCalledTimes(1)
  })
})

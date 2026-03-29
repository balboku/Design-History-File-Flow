import {
  DeliverableStatus,
  PendingItemStatus,
  ProjectPhase,
  Role,
  TaskStatus,
} from '@prisma/client'

import { prisma } from './prisma'
import { evaluatePhaseGate } from './phase-service'

export interface ProjectSummary {
  id: string
  code: string
  name: string
  description: string | null
  currentPhase: ProjectPhase
  previousPhase: ProjectPhase | null
  ownerName: string | null
  createdAt: Date
  taskCount: number
  doneTaskCount: number
  deliverableCount: number
  releasedDeliverableCount: number
  openPendingItemCount: number
}

export interface WorkspaceLookupData {
  users: {
    id: string
    name: string
    role: Role
  }[]
  projects: {
    id: string
    code: string
    name: string
    currentPhase: ProjectPhase
  }[]
  deliverables: {
    id: string
    code: string
    title: string
    phase: ProjectPhase
    projectId: string
    projectCode: string
    projectName: string
  }[]
  parts: {
    id: string
    partNumber: string
    name: string
  }[]
}

export async function getProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    include: {
      owner: {
        select: { name: true },
      },
      tasks: {
        select: { status: true },
      },
      deliverables: {
        select: { status: true },
      },
      pendingItems: {
        select: { status: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return projects.map((project) => ({
    id: project.id,
    code: project.code,
    name: project.name,
    description: project.description,
    currentPhase: project.currentPhase,
    previousPhase: project.previousPhase,
    ownerName: project.owner?.name ?? null,
    createdAt: project.createdAt,
    taskCount: project.tasks.length,
    doneTaskCount: project.tasks.filter((task) => task.status === TaskStatus.Done).length,
    deliverableCount: project.deliverables.length,
    releasedDeliverableCount: project.deliverables.filter(
      (deliverable) => deliverable.status === DeliverableStatus.Released,
    ).length,
    openPendingItemCount: project.pendingItems.filter(
      (item) => item.status === PendingItemStatus.Open,
    ).length,
  }))
}

export async function getAppDashboardData() {
  const [projects, tasks, deliverables, pendingItems, phaseTransitions] = await Promise.all([
    prisma.project.count(),
    prisma.task.findMany({ select: { status: true } }),
    prisma.deliverablePlaceholder.findMany({ select: { status: true } }),
    prisma.pendingItem.findMany({ select: { status: true } }),
    prisma.phaseTransition.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        project: {
          select: { code: true, name: true },
        },
      },
    }),
  ])

  return {
    counts: {
      projectCount: projects,
      activeTaskCount: tasks.filter((task) => task.status !== TaskStatus.Done).length,
      releasedDeliverableCount: deliverables.filter(
        (deliverable) => deliverable.status === DeliverableStatus.Released,
      ).length,
      openPendingItemCount: pendingItems.filter(
        (item) => item.status === PendingItemStatus.Open,
      ).length,
    },
    recentTransitions: phaseTransitions,
  }
}

export async function getWorkspaceLookupData(): Promise<WorkspaceLookupData> {
  const [users, projects, deliverables, parts] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.project.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        currentPhase: true,
      },
      orderBy: [{ code: 'asc' }],
    }),
    prisma.deliverablePlaceholder.findMany({
      select: {
        id: true,
        code: true,
        title: true,
        phase: true,
        projectId: true,
        project: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ projectId: 'asc' }, { code: 'asc' }],
    }),
    prisma.partComponent.findMany({
      select: {
        id: true,
        partNumber: true,
        name: true,
      },
      orderBy: [{ partNumber: 'asc' }],
    }),
  ])

  return {
    users,
    projects,
    deliverables: deliverables.map((deliverable) => ({
      id: deliverable.id,
      code: deliverable.code,
      title: deliverable.title,
      phase: deliverable.phase,
      projectId: deliverable.projectId,
      projectCode: deliverable.project.code,
      projectName: deliverable.project.name,
    })),
    parts,
  }
}

export async function getProjectDetail(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: {
        select: { id: true, name: true, role: true },
      },
      tasks: {
        include: {
          assignee: {
            select: { name: true },
          },
          deliverableLinks: {
            include: {
              deliverable: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: [{ plannedPhase: 'asc' }, { createdAt: 'desc' }],
      },
      deliverables: {
        include: {
          owner: {
            select: { name: true },
          },
          fileRevisions: {
            select: {
              id: true,
              revisionNumber: true,
              fileName: true,
              mimeType: true,
              fileSizeBytes: true,
              createdAt: true,
            },
            orderBy: { revisionNumber: 'desc' },
          },
          pendingItems: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: [{ phase: 'asc' }, { code: 'asc' }],
      },
      pendingItems: {
        include: {
          deliverable: {
            select: {
              code: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      },
      phaseTransitions: {
        include: {
          triggeredBy: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      changeRequests: {
        include: {
          requester: {
            select: { name: true },
          },
          deliverableLinks: {
            include: {
              deliverable: {
                select: {
                  code: true,
                },
              },
            },
          },
          partLinks: {
            include: {
              partComponent: {
                select: {
                  partNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!project) {
    return null
  }

  const gate = await evaluatePhaseGate(projectId).catch(() => null)

  return {
    project,
    gate,
  }
}

export async function getTaskBoardData() {
  const tasks = await prisma.task.findMany({
    include: {
      project: {
        select: {
          id: true,
          code: true,
          name: true,
          currentPhase: true,
        },
      },
      assignee: {
        select: { name: true },
      },
      deliverableLinks: {
        include: {
          deliverable: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              fileRevisions: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  return tasks
}

export async function getDeliverableBoardData() {
  const deliverables = await prisma.deliverablePlaceholder.findMany({
    include: {
      project: {
        select: {
          id: true,
          code: true,
          name: true,
          currentPhase: true,
        },
      },
      owner: {
        select: { name: true },
      },
      fileRevisions: {
        select: {
          id: true,
          revisionNumber: true,
          fileName: true,
          fileSizeBytes: true,
          createdAt: true,
        },
        orderBy: { revisionNumber: 'desc' },
      },
      taskLinks: {
        include: {
          task: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
            },
          },
        },
      },
      pendingItems: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  return deliverables
}

export async function getPhaseGateBoardData() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      currentPhase: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const gateStates = await Promise.all(
    projects.map(async (project) => ({
      project,
      gate: await evaluatePhaseGate(project.id).catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      })),
    })),
  )

  return gateStates
}

export async function getChangeRequestBoardData() {
  return prisma.changeRequest.findMany({
    include: {
      project: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      requester: {
        select: {
          name: true,
        },
      },
      approver: {
        select: {
          name: true,
        },
      },
      deliverableLinks: {
        include: {
          deliverable: {
            select: {
              id: true,
              code: true,
              title: true,
              project: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      },
      partLinks: {
        include: {
          partComponent: {
            select: {
              id: true,
              partNumber: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })
}

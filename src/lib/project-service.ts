import { ProjectPhase } from '@prisma/client'

import { recordAudit, AuditActions } from './audit-log-service'
import { prisma } from './prisma'

export interface CreateProjectInput {
  code: string
  name: string
  description?: string
  currentPhase?: ProjectPhase
  ownerId?: string | null
  targetEndDate?: Date | null
}

export interface CreateProjectResult {
  project: {
    id: string
    code: string
    name: string
    currentPhase: ProjectPhase
  }
}

export async function createProject(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const code = input.code.trim()
  const name = input.name.trim()

  if (!code) {
    throw new Error('Project code is required.')
  }

  if (!name) {
    throw new Error('Project name is required.')
  }

  if (input.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: input.ownerId },
      select: { id: true },
    })

    if (!owner) {
      throw new Error(`Project owner not found: ${input.ownerId}`)
    }
  }

  const project = await prisma.project.create({
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      currentPhase: input.currentPhase ?? ProjectPhase.Concept,
      ownerId: input.ownerId ?? null,
      targetEndDate: input.targetEndDate ?? null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      currentPhase: true,
    },
  })
  await recordAudit({
    action: AuditActions.PROJECT_CREATE,
    entityType: 'Project',
    entityId: project.id,
    actorId: input.ownerId,
    detail: {
      code: project.code,
      name: project.name,
      currentPhase: project.currentPhase,
    },
  })

  return { project }
}

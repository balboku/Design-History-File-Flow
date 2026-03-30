'use server'

import { createProject, type TemplateType } from '@/lib/project-service'

export interface CreateProjectActionInput {
  code: string
  name: string
  description?: string
  currentPhase?: import('@prisma/client').ProjectPhase
  ownerId?: string | null
  targetEndDate?: string | null
  templateType?: TemplateType
}

export type CreateProjectActionResult = {
  success: true
  data: Awaited<ReturnType<typeof createProject>>['project']
  deliverableCount: number
} | {
  success: false
  error: string
}

export async function createProjectAction(
  input: CreateProjectActionInput,
): Promise<CreateProjectActionResult> {
  try {
    const result = await createProject({
      ...input,
      targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null,
    })
    return { success: true, data: result.project, deliverableCount: result.deliverableCount }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

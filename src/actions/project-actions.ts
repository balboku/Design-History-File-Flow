'use server'

import { createProject } from '@/lib/project-service'

export interface CreateProjectActionInput {
  code: string
  name: string
  description?: string
  currentPhase?: import('@prisma/client').ProjectPhase
  ownerId?: string | null
}

export type CreateProjectActionResult = {
  success: true
  data: Awaited<ReturnType<typeof createProject>>['project']
} | {
  success: false
  error: string
}

export async function createProjectAction(
  input: CreateProjectActionInput,
): Promise<CreateProjectActionResult> {
  try {
    const result = await createProject(input)
    return { success: true, data: result.project }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

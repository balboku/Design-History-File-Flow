'use server'

import { advancePhase, evaluatePhaseGate, PhaseGateIssue } from '@/lib/phase-service'

// ─── Evaluate Gate ─────────────────────────────────────────────────────────────

export interface EvaluateGateResult {
  success: true
  canAdvance: true
  nextPhase: string
} | {
  success: true
  canAdvance: false
  issues: PhaseGateIssue[]
  isHardGate: boolean
} | {
  success: false
  error: string
}

export async function evaluatePhaseGateAction(
  projectId: string,
): Promise<EvaluateGateResult> {
  try {
    const result = await evaluatePhaseGate(projectId)
    return {
      success: true,
      canAdvance: result.canAdvance,
      ...(result.canAdvance
        ? { nextPhase: result.nextPhase }
        : { issues: result.issues, isHardGate: result.isHardGate }),
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Advance Phase ─────────────────────────────────────────────────────────────

export interface AdvancePhaseActionInput {
  projectId: string
  override?: {
    overriddenById: string
    rationale?: string
  }
}

export interface AdvancePhaseActionResult {
  success: true
  project: {
    id: string
    code: string
    name: string
    previousPhase: string
    currentPhase: string
  }
  wasOverridden: boolean
} | {
  success: false
  reason: 'blocked' | 'hard_gate' | 'error'
  message: string
  issues: PhaseGateIssue[]
}

export async function advancePhaseAction(
  input: AdvancePhaseActionInput,
): Promise<AdvancePhaseActionResult> {
  try {
    const result = await advancePhase(input.projectId, input.override)

    if (result.success) {
      return {
        success: true,
        wasOverridden: result.wasOverridden,
        project: {
          id: result.project.id,
          code: result.project.code,
          name: result.project.name,
          previousPhase: result.project.previousPhase,
          currentPhase: result.project.currentPhase,
        },
      }
    }

    // Gate failed
    return {
      success: false,
      reason: result.reason,
      message: result.message,
      issues: result.issues,
    }
  } catch (err) {
    return {
      success: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
      issues: [],
    }
  }
}

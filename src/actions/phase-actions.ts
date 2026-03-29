'use server'

import { advancePhase, evaluatePhaseGate, PhaseGateIssue } from '@/lib/phase-service'

// ─── Evaluate Gate ─────────────────────────────────────────────────────────────

export type EvaluateGateResult = {
  success: true
  canAdvance: true
  nextPhase: string
} | {
  success: true
  canAdvance: false
  isHardGate: boolean
  issues: PhaseGateIssue[]
} | {
  success: false
  error: string
}

export async function evaluatePhaseGateAction(
  projectId: string,
): Promise<EvaluateGateResult> {
  try {
    const result = await evaluatePhaseGate(projectId)
    if (result.canAdvance) {
      return {
        success: true,
        canAdvance: true,
        nextPhase: result.nextPhase,
      }
    }

    return {
      success: true,
      canAdvance: false,
      issues: result.issues,
      isHardGate: result.isHardGate,
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Advance Phase ─────────────────────────────────────────────────────────────

export interface AdvancePhaseActionInput {
  projectId: string
  forceOverride?: boolean
  overriddenById?: string
  rationale?: string
}

export type AdvancePhaseActionResult = Awaited<ReturnType<typeof advancePhase>>

export async function advancePhaseAction(
  input: AdvancePhaseActionInput,
): Promise<AdvancePhaseActionResult> {
  try {
    return await advancePhase(input.projectId, {
      forceOverride: input.forceOverride,
      overriddenById: input.overriddenById,
      rationale: input.rationale,
    })
  } catch (err) {
    // Re-throw domain errors as-is; let callers handle them
    throw err
  }
}

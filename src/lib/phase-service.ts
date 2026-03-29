import { prisma } from './prisma'
import { ProjectPhase, DeliverableStatus } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhaseGateIssue {
  deliverableId: string
  deliverableCode: string
  deliverableTitle: string
  currentStatus: DeliverableStatus
  reason: string
}

/** Advance succeeded without any issues. */
export interface AdvancePhaseSuccess {
  success: true
  outcome: 'advanced'
  project: {
    id: string
    code: string
    name: string
    previousPhase: ProjectPhase
    currentPhase: ProjectPhase
  }
}

/**
 * Gate evaluation found missing deliverables, but the PM chose to force-advance.
 * The project has moved forward and this override is recorded as an audit event.
 */
export interface AdvancePhaseForced {
  success: true
  outcome: 'forced'
  project: {
    id: string
    code: string
    name: string
    previousPhase: ProjectPhase
    currentPhase: ProjectPhase
  }
  issues: PhaseGateIssue[]
}

/**
 * Gate evaluation found missing deliverables. The PM must review the issues
 * and re-call with `forceOverride: true` if they accept the risk.
 */
export interface AdvancePhaseWarning {
  success: true
  outcome: 'warning'
  message: string
  issues: PhaseGateIssue[]
  isHardGate: boolean
}

/** DesignTransfer is a hard gate — it cannot be overridden. */
export interface AdvancePhaseHardGate {
  success: false
  reason: 'hard_gate'
  message: string
  issues: PhaseGateIssue[]
}

export type AdvancePhaseResult =
  | AdvancePhaseSuccess
  | AdvancePhaseForced
  | AdvancePhaseWarning
  | AdvancePhaseHardGate

// ─── Phase ordering ───────────────────────────────────────────────────────────

const PHASE_ORDER: ProjectPhase[] = [
  ProjectPhase.Concept,
  ProjectPhase.Planning,
  ProjectPhase.DesignInput,
  ProjectPhase.DesignOutput,
  ProjectPhase.Verification,
  ProjectPhase.Validation,
  ProjectPhase.DesignTransfer,
  ProjectPhase.PostMarket,
]

function getNextPhase(current: ProjectPhase): ProjectPhase | null {
  const idx = PHASE_ORDER.indexOf(current)
  return idx === -1 || idx === PHASE_ORDER.length - 1 ? null : PHASE_ORDER[idx + 1]
}

// ─── Gate Evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluates whether a project can safely advance to the next phase.
 *
 * Gate rules (CLAUDE.md):
 * - All required DeliverablePlaceholders for the *current* phase must be Released.
 * - DesignTransfer is a hard gate: ALL required deliverables across ALL prior phases
 *   must be Released; no override is permitted.
 * - Returns a detailed issue list for the PM.
 */
export async function evaluatePhaseGate(
  projectId: string,
): Promise<
  | { canAdvance: true; nextPhase: ProjectPhase }
  | { canAdvance: false; issues: PhaseGateIssue[]; isHardGate: boolean }
> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, code: true, currentPhase: true },
  })

  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const target = getNextPhase(project.currentPhase)
  if (!target) {
    throw new Error(`Project is already at the final phase: ${project.currentPhase}`)
  }

  const isHardGate = target === ProjectPhase.DesignTransfer

  // Hard gate: check ALL required deliverables across all prior + current phases.
  // Soft gate: check only deliverables for the current phase.
  const whereClause = isHardGate
    ? { projectId, isRequired: true }
    : { projectId, phase: project.currentPhase, isRequired: true }

  const deliverables = await prisma.deliverablePlaceholder.findMany({
    where: whereClause,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      phase: true,
    },
  })

  const issues: PhaseGateIssue[] = deliverables
    .filter((d) => d.status !== DeliverableStatus.Released)
    .map((d) => ({
      deliverableId: d.id,
      deliverableCode: d.code,
      deliverableTitle: d.title,
      currentStatus: d.status,
      reason:
        d.status === DeliverableStatus.Draft
          ? '文件尚在草稿狀態，未完成'
          : '文件狀態非 Released，QA 尚未核准',
    }))

  if (issues.length > 0) {
    return { canAdvance: false, issues, isHardGate }
  }

  return { canAdvance: true, nextPhase: target }
}

// ─── Phase Advance ────────────────────────────────────────────────────────────

/**
 * Advances a project to the next phase, subject to gate evaluation.
 *
 * Flow:
 *  1. Evaluate gate — check all required deliverables for the current phase.
 *  2. If gate passes → advance (outcome: "advanced").
 *  3. If gate fails and isHardGate → return hard_gate error (outcome: "hard_gate").
 *  4. If gate fails on a soft gate:
 *     - No forceOverride → return warning with issue list (outcome: "warning").
 *     - forceOverride: true → advance anyway, record audit log (outcome: "forced").
 *
 * @param projectId
 * @param options.forceOverride   - PM accepts the risk and forces advancement (soft gates only).
 *                                  DesignTransfer can never be overridden.
 * @param options.overriddenById  - Required when forceOverride is true; records who triggered it.
 * @param options.rationale       - Optional note on why the override was triggered.
 */
export async function advancePhase(
  projectId: string,
  options?: {
    forceOverride?: boolean
    overriddenById?: string
    rationale?: string
  },
): Promise<AdvancePhaseResult> {
  const gate = await evaluatePhaseGate(projectId)

  // ── Gate passed ──────────────────────────────────────────────────────────────
  if (gate.canAdvance) {
    let previousPhase: ProjectPhase

    try {
      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.project.findUnique({
          where: { id: projectId },
          select: { id: true, code: true, name: true, currentPhase: true },
        })
        if (!current) throw new Error(`Project not found: ${projectId}`)

        previousPhase = current.currentPhase

        const target = getNextPhase(current.currentPhase)
        if (!target) throw new Error('Already at final phase')

        return tx.project.update({
          where: { id: projectId },
          data: { currentPhase: target, previousPhase: current.currentPhase },
          select: { id: true, code: true, name: true, currentPhase: true },
        })
      })

      return {
        success: true,
        outcome: 'advanced',
        project: {
          id: result.id,
          code: result.code,
          name: result.name,
          previousPhase,
          currentPhase: result.currentPhase,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.startsWith('Project not found') || msg === 'Already at final phase') throw err
      throw new Error(`Phase advancement transaction failed: ${msg}`)
    }
  }

  // ── Gate failed ─────────────────────────────────────────────────────────────
  const { issues, isHardGate } = gate

  // DesignTransfer hard gate — no override permitted under any circumstances
  if (isHardGate) {
    return {
      success: false,
      reason: 'hard_gate',
      message: `「${ProjectPhase.DesignTransfer}」為嚴格關卡，所有文件必須完成並核准後才能推進，不接受 Override。`,
      issues,
    }
  }

  // Soft gate — return warning with issue list
  if (!options?.forceOverride) {
    const list = issues
      .map((i) => `[${i.deliverableCode}] ${i.deliverableTitle}（${i.reason}）`)
      .join('\n')
    return {
      success: true,
      outcome: 'warning',
      isHardGate: false,
      message: `以下 ${issues.length} 項文件尚未 Released，請完成後再推進，或使用 forceOverride 參數強制推進：\n${list}`,
      issues,
    }
  }

  // forceOverride=true — PM accepts risk; advance and record audit
  let previousPhase: ProjectPhase

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true, code: true, name: true, currentPhase: true },
      })
      if (!current) throw new Error(`Project not found: ${projectId}`)

      previousPhase = current.currentPhase

      const target = getNextPhase(current.currentPhase)
      if (!target) throw new Error('Already at final phase')

      // Persist override as an audit event
      await tx.phaseTransition.create({
        data: {
          projectId,
          fromPhase: current.currentPhase,
          toPhase: target,
          triggeredById: options.overriddenById ?? null,
          wasOverride: true,
          overrideReason: options.rationale ?? null,
        },
      })

      return tx.project.update({
        where: { id: projectId },
        data: { currentPhase: target, previousPhase: current.currentPhase },
        select: { id: true, code: true, name: true, currentPhase: true },
      })
    })

    return {
      success: true,
      outcome: 'forced',
      project: {
        id: result.id,
        code: result.code,
        name: result.name,
        previousPhase,
        currentPhase: result.currentPhase,
      },
      issues,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.startsWith('Project not found') || msg === 'Already at final phase') throw err
    throw new Error(`Phase advancement transaction failed: ${msg}`)
  }
}

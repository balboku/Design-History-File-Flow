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

export interface AdvancePhaseSuccess {
  success: true
  project: {
    id: string
    code: string
    name: string
    previousPhase: ProjectPhase
    currentPhase: ProjectPhase
  }
  wasOverridden: boolean
}

export interface AdvancePhaseBlocked {
  success: false
  reason: 'blocked' | 'hard_gate'
  message: string
  issues: PhaseGateIssue[]
}

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
 * @param projectId
 * @param override  - When provided, the PM has explicitly accepted the risk of
 *                   proceeding despite missing deliverables (soft gates only).
 *                   DesignTransfer can never be overridden.
 */
export async function advancePhase(
  projectId: string,
  override?: {
    overriddenById: string
    rationale?: string
  },
): Promise<AdvancePhaseSuccess | AdvancePhaseBlocked> {
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

        // If this is an override (rare but allowed for soft gates), persist audit record
        if (override) {
          await tx.phaseTransition.create({
            data: {
              projectId,
              fromPhase: current.currentPhase,
              toPhase: target,
              triggeredById: override.overriddenById,
              wasOverride: true,
              overrideReason: override.rationale ?? null,
            },
          })
        }

        return tx.project.update({
          where: { id: projectId },
          data: { currentPhase: target, previousPhase: current.currentPhase },
          select: { id: true, code: true, name: true, currentPhase: true },
        })
      })

      return {
        success: true,
        wasOverridden: Boolean(override),
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
      if (msg === `Project not found: ${projectId}` || msg === 'Already at final phase') {
        throw err
      }
      throw new Error(`Phase advancement transaction failed: ${msg}`)
    }
  }

  // ── Gate failed ─────────────────────────────────────────────────────────────
  const { issues, isHardGate } = gate

  // DesignTransfer hard gate — no override under any circumstances
  if (isHardGate) {
    return {
      success: false,
      reason: 'hard_gate',
      message: `「${ProjectPhase.DesignTransfer}」為嚴格關卡，所有文件必須完成並核准後才能推進，不接受 Override。`,
      issues,
    }
  }

  // Soft gate — override is optional; if not provided, return blocked result
  if (!override) {
    const list = issues.map((i) => `[${i.deliverableCode}] ${i.deliverableTitle}（${i.reason}）`).join('\n')
    return {
      success: false,
      reason: 'blocked',
      message: `以下 ${issues.length} 項文件尚未 Released，請完成後再推進，或提供 PM override 決策以繼續：\n${list}`,
      issues,
    }
  }

  // Override provided — create audit record and advance
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

      await tx.phaseTransition.create({
        data: {
          projectId,
          fromPhase: current.currentPhase,
          toPhase: target,
          triggeredById: override.overriddenById,
          wasOverride: true,
          overrideReason: override.rationale ?? null,
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
      wasOverridden: true,
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
    if (msg === `Project not found: ${projectId}` || msg === 'Already at final phase') {
      throw err
    }
    throw new Error(`Phase advancement transaction failed: ${msg}`)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { advancePhase, evaluatePhaseGate } from '@/lib/phase-service'

// ─── GET /api/project/phase?projectId=xxx ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'Missing required query parameter: projectId' },
      { status: 400 },
    )
  }

  try {
    const gate = await evaluatePhaseGate(projectId)
    return NextResponse.json({
      success: true,
      canAdvance: gate.canAdvance,
      ...(gate.canAdvance
        ? { nextPhase: gate.nextPhase }
        : { isHardGate: gate.isHardGate, issues: gate.issues }),
    })
  } catch (err) {
    const status =
      err instanceof Error && err.message.includes('not found') ? 404 : 500
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status },
    )
  }
}

// ─── POST /api/project/phase ───────────────────────────────────────────────────

interface AdvancePhaseBody {
  projectId: string
  forceOverride?: boolean
  overriddenById?: string
  rationale?: string
}

export async function POST(req: NextRequest) {
  let body: AdvancePhaseBody

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { projectId, forceOverride, overriddenById, rationale } = body

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: projectId' },
      { status: 400 },
    )
  }

  if (forceOverride === true && !overriddenById) {
    return NextResponse.json(
      {
        success: false,
        error: 'forceOverride=true requires overriddenById to record the audit trail',
      },
      { status: 400 },
    )
  }

  try {
    const result = await advancePhase(projectId, {
      forceOverride,
      overriddenById,
      rationale,
    })

    // 2xx for all success cases (including "warning" and "forced")
    const status =
      result.outcome === 'warning' ? 202 : result.outcome === 'forced' ? 202 : 200

    return NextResponse.json(result, { status })
  } catch (err) {
    const status =
      err instanceof Error && err.message.includes('not found') ? 404 : 500
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status },
    )
  }
}

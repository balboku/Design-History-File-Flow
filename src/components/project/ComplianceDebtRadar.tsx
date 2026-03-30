'use client'

import { ProjectPhase } from '@prisma/client'
import { PHASE_ORDER } from '@/lib/phase-service'

interface Deliverable {
  id: string
  status: string
  isRequired?: boolean
  targetDate?: Date | string | null
  fileRevisions?: { id: string }[]
}

interface PendingItem {
  id: string
  status: string
}

interface Props {
  deliverables: Deliverable[]
  pendingItems: PendingItem[]
  currentPhase: ProjectPhase
}

interface RadarDimension {
  label: string
  value: number      // 0–100
  count?: string
  tone: 'green' | 'amber' | 'red' | 'slate'
}

export function ComplianceDebtRadar({ deliverables, pendingItems, currentPhase }: Props) {
  const now = new Date()
  const openPending = pendingItems.filter((i) => i.status === 'Open').length
  const requiredDeliverables = deliverables.filter((d) => d.isRequired !== false)
  const releasedRequired = requiredDeliverables.filter((d) => d.status === 'Released').length
  const overdueRequired = requiredDeliverables.filter(
    (d) => d.status !== 'Released' && d.targetDate && new Date(d.targetDate as string) < now,
  ).length
  const docCompletionPct = requiredDeliverables.length > 0
    ? Math.round((releasedRequired / requiredDeliverables.length) * 100)
    : 100
  const nearDesignTransfer =
    PHASE_ORDER.indexOf(currentPhase) >= PHASE_ORDER.indexOf(ProjectPhase.Validation)

  // ── Risk level ──────────────────────────────────────────────────────────────
  const isHighRisk = openPending > 5 || overdueRequired > 0
  const isMedRisk =
    !isHighRisk && (openPending > 2 || docCompletionPct < 70)
  const isDesignTransferBlocked = nearDesignTransfer && openPending > 0

  const riskLabel = isHighRisk
    ? '高風險債務'
    : isMedRisk
      ? '中度警示'
      : '健康'
  const riskColor = isHighRisk ? 'bg-red-500' : isMedRisk ? 'bg-amber-400' : 'bg-emerald-400'
  const riskBg = isHighRisk ? 'bg-red-50 border-red-100' : isMedRisk ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50/60 border-emerald-100'
  const riskText = isHighRisk ? 'text-red-700' : isMedRisk ? 'text-amber-700' : 'text-emerald-700'

  // ── Dimensions ──────────────────────────────────────────────────────────────
  const dimensions: RadarDimension[] = [
    {
      label: '必要文件釋出率',
      value: docCompletionPct,
      count: `${releasedRequired} / ${requiredDeliverables.length}`,
      tone: docCompletionPct >= 80 ? 'green' : docCompletionPct >= 50 ? 'amber' : 'red',
    },
    {
      label: '未結遺留項',
      value: Math.max(0, 100 - openPending * 10),
      count: `${openPending} 件`,
      tone: openPending === 0 ? 'green' : openPending <= 2 ? 'amber' : 'red',
    },
    {
      label: '逾期必要文件',
      value: Math.max(0, 100 - overdueRequired * 25),
      count: `${overdueRequired} 份逾期`,
      tone: overdueRequired === 0 ? 'green' : overdueRequired === 1 ? 'amber' : 'red',
    },
    {
      label: '關卡通過準備度',
      value: nearDesignTransfer && openPending > 0 ? Math.max(0, 100 - openPending * 20) : docCompletionPct,
      count: nearDesignTransfer ? (openPending > 0 ? '硬關卡阻擋中' : '可過關') : '關卡尚遠',
      tone: nearDesignTransfer ? (openPending > 0 ? 'red' : 'green') : 'slate',
    },
  ]

  const barColor: Record<RadarDimension['tone'], string> = {
    green: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-500',
    slate: 'bg-slate-300',
  }
  const trackColor: Record<RadarDimension['tone'], string> = {
    green: 'bg-emerald-100',
    amber: 'bg-amber-100',
    red: 'bg-red-100',
    slate: 'bg-slate-100',
  }

  return (
    <div className={`rounded-2xl border p-5 ${riskBg}`}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-3 w-3 rounded-full ${riskColor}`} />
          <h4 className={`m-0 text-[14px] font-bold ${riskText}`}>
            合規債務雷達 — {riskLabel}
          </h4>
        </div>
        {isDesignTransferBlocked && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-[12px] font-bold text-red-700 ring-1 ring-red-200">
            ⚠ 硬關卡阻擋預警：DesignTransfer 將近，尚有 {openPending} 項未結遺留項
          </span>
        )}
        {isHighRisk && !isDesignTransferBlocked && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-[12px] font-bold text-red-700 ring-1 ring-red-200">
            ⚠ 高風險：請儘速處理遺留項與逾期文件
          </span>
        )}
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dimensions.map((dim) => (
          <div key={dim.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-slate-600">{dim.label}</span>
              <span className={`text-[12px] font-bold ${
                dim.tone === 'red' ? 'text-red-600' : dim.tone === 'amber' ? 'text-amber-600' : dim.tone === 'green' ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                {dim.count}
              </span>
            </div>
            <div className={`h-2 w-full rounded-full ${trackColor[dim.tone]}`}>
              <div
                className={`h-2 rounded-full transition-all duration-700 ${barColor[dim.tone]}`}
                style={{ width: `${dim.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

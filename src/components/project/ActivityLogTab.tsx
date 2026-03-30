'use client'

import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface AuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  detail: string | null
  createdAt: Date
  actor?: { name: string } | null
}

interface Props {
  auditLogs: AuditLogEntry[]
}

const ACTION_LABELS: Record<string, string> = {
  'project.create': '建立專案',
  'task.create': '建立任務',
  'task.start': '開始任務',
  'task.complete': '完成任務',
  'task.update': '更新任務',
  'deliverable.create': '建立文件',
  'deliverable.statusChange': '變更文件狀態',
  'fileRevision.upload': '上傳文件版次',
  'attachment.upload': '上傳參考附件',
  'attachment.delete': '刪除參考附件',
  'phase.advance': '推進階段',
  'phase.override': '階段覆蓋',
  'pendingItem.resolve': '解決待辦事項',
  'changeRequest.create': '建立變更單',
  'changeRequest.transition': '變更單轉移',
}

function getActionColor(action: string): string {
  if (action.startsWith('task.')) return 'bg-blue-50 border-blue-200'
  if (action.startsWith('deliverable.')) return 'bg-emerald-50 border-emerald-200'
  if (action.startsWith('phase.')) return 'bg-orange-50 border-orange-200'
  if (action.startsWith('fileRevision.') || action.startsWith('attachment.')) return 'bg-purple-50 border-purple-200'
  return 'bg-slate-50 border-slate-200'
}

function getActionIcon(action: string): string {
  if (action.startsWith('task.')) return '📋'
  if (action.startsWith('deliverable.')) return '📄'
  if (action.startsWith('phase.')) return '🚀'
  if (action.startsWith('fileRevision.') || action.startsWith('attachment.')) return '📎'
  return '•'
}

export function ActivityLogTab({ auditLogs }: Props) {
  if (auditLogs.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 py-12">
        <div className="text-center">
          <div className="mb-2 text-[14px] font-bold text-slate-600">尚無活動紀錄</div>
          <div className="text-[12px] text-slate-400">此專案還沒有任何操作記錄</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
        共 {auditLogs.length} 筆紀錄
      </div>

      <div className="space-y-3">
        {auditLogs.map((log, idx) => (
          <div
            key={log.id}
            className={`relative flex gap-4 rounded-xl border p-4 transition-all ${getActionColor(
              log.action,
            )}`}
          >
            {/* Timeline line */}
            {idx < auditLogs.length - 1 && (
              <div className="absolute left-[23px] top-full h-3 w-0.5 bg-gradient-to-b from-slate-200 to-transparent" />
            )}

            {/* Timeline dot */}
            <div className="shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-inherit text-[18px]">
                {getActionIcon(log.action)}
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <div className="text-[14px] font-bold text-slate-800">
                    {ACTION_LABELS[log.action] || log.action}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5">
                    {log.actor?.name || '系統'} · {log.entityType}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] font-medium text-slate-400 whitespace-nowrap">
                  {formatDistanceToNow(new Date(log.createdAt), {
                    addSuffix: true,
                    locale: zhTW,
                  })}
                </div>
              </div>

              {/* Detail Info */}
              {log.detail && (
                <div className="mt-2 rounded-lg bg-white/50 px-3 py-2 text-[12px] text-slate-600 font-mono break-words max-h-16 overflow-y-auto">
                  {(() => {
                    try {
                      const detail = JSON.parse(log.detail)
                      return Object.entries(detail)
                        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                        .join(' · ')
                    } catch {
                      return log.detail
                    }
                  })()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

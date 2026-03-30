'use client'

import { useState, type CSSProperties, useEffect } from 'react'

interface DeliverableOption {
  id: string
  code: string
  title: string
  projectCode: string
}

interface PartOption {
  id: string
  partNumber: string
  name: string
}

interface UserOption {
  id: string
  name: string
  role: string
}

interface ProjectOption {
  id: string
  code: string
  name: string
}

interface Props {
  action: (payload: FormData) => void
  projects: ProjectOption[]
  users: UserOption[]
  deliverables: DeliverableOption[]
  parts: PartOption[]
}

const baseInputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  padding: '14px 16px',
  fontSize: 15,
  boxSizing: 'border-box',
}

const darkInputStyle: CSSProperties = {
  ...baseInputStyle,
  background: 'rgba(255, 244, 228, 0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  color: '#fff7ec',
}

const lightButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#fff4df',
  color: '#442e17',
  fontWeight: 700,
  cursor: 'pointer',
}

export function CreateChangeRequestForm({ action, projects, users, deliverables, parts }: Props) {
  const [selectedParts, setSelectedParts] = useState<string[]>([])
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>([])
  const [impactSummary, setImpactSummary] = useState('')
  const [showChecklist, setShowChecklist] = useState(false)

  // Determine which questions to show based on selection
  const handleDeliverablesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value)
    setSelectedDeliverables(values)
  }

  const handlePartsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value)
    setSelectedParts(values)
  }

  useEffect(() => {
    if (selectedParts.length > 0 || selectedDeliverables.length > 0) {
      setShowChecklist(true)
    } else {
      setShowChecklist(false)
    }
  }, [selectedParts, selectedDeliverables])

  const hasVerificationDocs = selectedDeliverables.some((id) => {
    const doc = deliverables.find((d) => d.id === id)
    return doc && (doc.title.includes('Verification') || doc.title.includes('Protocol'))
  })
  
  const hasParts = selectedParts.length > 0

  const appendToSummary = (text: string) => {
    if (!impactSummary.includes(text)) {
      setImpactSummary((prev) => (prev ? prev + '\n' + text : text))
    }
  }

  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      {showChecklist && (
        <div style={{ background: 'rgba(255,160,50,0.15)', border: '1px solid rgba(255,160,50,0.3)', borderRadius: 16, padding: '16px', marginBottom: 8 }}>
          <div style={{ color: '#ffd6a5', fontSize: 13, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✨ 影響評估引導
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hasParts && (
              <>
                <button
                  type="button"
                  onClick={() => appendToSummary('需更新 BOM 表並發布新料號。')}
                  style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                >
                  ＋ 是否影響 BOM 表？
                </button>
                <button
                  type="button"
                  onClick={() => appendToSummary('需重新執行 ISO 10993 生物相容性評估。')}
                  style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                >
                  ＋ 是否需重新進行生物相容性評估？
                </button>
              </>
            )}
            {hasVerificationDocs && (
              <button
                type="button"
                onClick={() => appendToSummary('需重新抽樣執行測試案例並產出新驗證報告。')}
                style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
              >
                ＋ 是否需重新執行測試案例？
              </button>
            )}
            <button
              type="button"
              onClick={() => appendToSummary('需發出 ECN 通知供應商進行製程變更。')}
              style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
            >
              ＋ 是否需通知供應商？
            </button>
          </div>
        </div>
      )}

      <input name="code" placeholder="CR 編號" style={darkInputStyle} required />
      <input name="title" placeholder="變更單名稱" style={darkInputStyle} required />
      <textarea
        name="description"
        placeholder="變更內容說明"
        style={{ ...darkInputStyle, minHeight: 90, resize: 'vertical' }}
      />
      
      <textarea
        name="impactSummary"
        placeholder="影響評估摘要"
        required
        value={impactSummary}
        onChange={(e) => setImpactSummary(e.target.value)}
        style={{ ...darkInputStyle, minHeight: 120, resize: 'vertical' }}
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <textarea name="regulatoryImpact" placeholder="法規影響" style={{ ...darkInputStyle, minHeight: 88, resize: 'vertical' }} />
        <textarea name="productRiskImpact" placeholder="產品風險影響" style={{ ...darkInputStyle, minHeight: 88, resize: 'vertical' }} />
        <textarea name="verificationImpact" placeholder="驗證影響" style={{ ...darkInputStyle, minHeight: 88, resize: 'vertical' }} />
        <textarea name="validationImpact" placeholder="確效影響" style={{ ...darkInputStyle, minHeight: 88, resize: 'vertical' }} />
        <textarea name="manufacturingImpact" placeholder="製造 / 移轉影響" style={{ ...darkInputStyle, minHeight: 88, resize: 'vertical' }} />
        <textarea name="documentationImpact" placeholder="文件影響" style={{ ...darkInputStyle, minHeight: 88, resize: 'vertical' }} />
      </div>

      <select name="projectId" defaultValue="" style={darkInputStyle}>
        <option value="">尚未指定專案</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.code} · {project.name}
          </option>
        ))}
      </select>
      
      <select name="requesterId" defaultValue="" style={darkInputStyle}>
        <option value="">提出人</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} · {user.role}
          </option>
        ))}
      </select>
      
      <select
        name="deliverableIds"
        multiple
        defaultValue={[]}
        onChange={handleDeliverablesChange}
        style={{ ...darkInputStyle, minHeight: 140 }}
      >
        {deliverables.map((deliverable) => (
          <option key={deliverable.id} value={deliverable.id}>
            {deliverable.projectCode} · {deliverable.code} · {deliverable.title}
          </option>
        ))}
      </select>
      
      <select
        name="partComponentIds"
        multiple
        defaultValue={[]}
        onChange={handlePartsChange}
        style={{ ...darkInputStyle, minHeight: 120 }}
      >
        {parts.map((part) => (
          <option key={part.id} value={part.id}>
            {part.partNumber} · {part.name}
          </option>
        ))}
      </select>
      
      <button type="submit" style={lightButtonStyle}>
        建立變更單
      </button>
    </form>
  )
}

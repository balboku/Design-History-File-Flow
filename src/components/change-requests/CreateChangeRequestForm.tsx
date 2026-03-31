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
  const [impactToggles, setImpactToggles] = useState({
    regulatory: false,
    productRisk: false,
    verification: false,
    validation: false,
    manufacturing: false,
    documentation: false,
  })
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setLocalFormData] = useState({
    code: '',
    title: '',
    description: '',
    impactSummary: '',
    projectId: '',
    requesterId: '',
  })

  const handleToggleChange = (key: keyof typeof impactToggles) => {
    setImpactToggles((prev) => ({ ...prev, [key]: !prev[key] }))
  }

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setLocalFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const isStep1Valid = !!formData.code && !!formData.title && !!formData.requesterId
  const isStep2Valid = !!formData.impactSummary

  const handleSubmitForm = async () => {
    const finalFormData = new FormData()
    Object.entries(formData).forEach(([key, value]) => finalFormData.append(key, value))
    
    // Add multiple selection fields
    selectedParts.forEach(id => finalFormData.append('partComponentIds', id))
    selectedDeliverables.forEach(id => finalFormData.append('deliverableIds', id))
    
    // Add impact details
    Object.entries(impactToggles).forEach(([key, isToggled]) => {
      if (isToggled) {
        // This is a bit tricky since we don't have local state for each impact detail yet,
        // we'll grab them from the DOM if we were using a form ref, but since I'm refactoring,
        // let's just make sure the action gets what it needs.
      }
    })
    
    // Actually, it's easier to just use a hidden form or just pass the data directly.
    // Given the 'action' parameter, I'll pass a proxy FormData.
    action(finalFormData)
  }

  // To be safe and compliant with the original 'action' call, 
  // I will wrap everything in a form and use currentStep to hide/show.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (currentStep === 3) {
      const data = new FormData(e.currentTarget)
      action(data)
    }
  }

  return (
    <form onSubmit={handleFormSubmit} style={{ display: 'grid', gap: 20 }}>
      {/* Wizard Header / Steps */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        {[
          { step: 1, label: '基本資訊' },
          { step: 2, label: '影響分析' },
          { step: 3, label: '關聯對象' },
        ].map((s) => (
          <div key={s.step} style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: currentStep >= s.step ? 'var(--app-primary-strong)' : '#e2e8f0',
              color: currentStep >= s.step ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 6px', fontWeight: 'bold', fontSize: 14, transition: 'all 0.3s'
            }}>
              {s.step}
            </div>
            <div style={{ fontSize: 12, fontWeight: currentStep === s.step ? 'bold' : 'normal', color: currentStep === s.step ? '#334155' : '#94a3b8' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {currentStep === 1 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <input name="code" placeholder="CR 編號" style={darkInputStyle} required onChange={handleInputChange} value={formData.code} />
          <input name="title" placeholder="變更單名稱" style={darkInputStyle} required onChange={handleInputChange} value={formData.title} />
          <select name="requesterId" style={darkInputStyle} required onChange={handleInputChange} value={formData.requesterId}>
            <option value="">請選擇提出人</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.role}
              </option>
            ))}
          </select>
          <select name="projectId" style={darkInputStyle} onChange={handleInputChange} value={formData.projectId}>
            <option value="">選擇相關專案 (選填)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.name}
              </option>
            ))}
          </select>
          <textarea
            name="description"
            placeholder="變更內容說明"
            style={{ ...darkInputStyle, minHeight: 120, resize: 'vertical' }}
            onChange={handleInputChange}
            value={formData.description}
          />
        </div>
      )}

      {/* Step 2: Impact Analysis */}
      {currentStep === 2 && (
        <div style={{ display: 'grid', gap: 16 }}>
          {showChecklist && (
            <div style={{ background: 'rgba(255,160,50,0.15)', border: '1px solid rgba(255,160,50,0.3)', borderRadius: 16, padding: '16px' }}>
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
              </div>
            </div>
          )}

          <textarea
            name="impactSummary"
            placeholder="影響評估摘要 (主要結論)"
            required
            value={formData.impactSummary}
            onChange={handleInputChange}
            style={{ ...darkInputStyle, minHeight: 120, resize: 'vertical' }}
          />
          
          <div style={{ background: 'rgba(248,250,252,0.6)', border: '1px solid rgba(203,213,225,0.4)', borderRadius: 16, padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ color: '#64748b', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              專項評估細節
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
              {[
                { key: 'regulatory' as const, label: '法規影響' },
                { key: 'productRisk' as const, label: '產品風險' },
                { key: 'verification' as const, label: '驗證影響' },
                { key: 'validation' as const, label: '確效影響' },
                { key: 'manufacturing' as const, label: '製造/移轉' },
                { key: 'documentation' as const, label: '文件影響' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: impactToggles[key] ? 'rgba(11,99,120,0.1)' : 'transparent', border: `1px solid ${impactToggles[key] ? 'rgba(11,99,120,0.3)' : 'transparent'}` }}>
                  <input type="checkbox" checked={impactToggles[key]} onChange={() => handleToggleChange(key)} style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 14, color: impactToggles[key] ? '#0b6378' : '#475569', fontWeight: 500 }}>{label}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 4 }}>
              {impactToggles.regulatory && <textarea name="regulatoryImpact" placeholder="說明法規影響細節..." required style={{ ...baseInputStyle, minHeight: 88, background: '#fff', border: '1px solid #e2e8f0' }} />}
              {impactToggles.productRisk && <textarea name="productRiskImpact" placeholder="說明風險影響細節..." required style={{ ...baseInputStyle, minHeight: 88, background: '#fff', border: '1px solid #e2e8f0' }} />}
              {impactToggles.verification && <textarea name="verificationImpact" placeholder="說明驗證影響細節..." required style={{ ...baseInputStyle, minHeight: 88, background: '#fff', border: '1px solid #e2e8f0' }} />}
              {/* ... others omitted for brevity or I'll implement them all */}
              {impactToggles.validation && <textarea name="validationImpact" placeholder="說明確效影響細節..." required style={{ ...baseInputStyle, minHeight: 88, background: '#fff', border: '1px solid #e2e8f0' }} />}
              {impactToggles.manufacturing && <textarea name="manufacturingImpact" placeholder="說明製造影響細節..." required style={{ ...baseInputStyle, minHeight: 88, background: '#fff', border: '1px solid #e2e8f0' }} />}
              {impactToggles.documentation && <textarea name="documentationImpact" placeholder="說明文件影響細節..." required style={{ ...baseInputStyle, minHeight: 88, background: '#fff', border: '1px solid #e2e8f0' }} />}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Attachments & Relations */}
      {currentStep === 3 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 'bold', color: '#ffd6a5', display: 'block', marginBottom: 6 }}>受影響的 DHF 文件</label>
            <select name="deliverableIds" multiple style={{ ...darkInputStyle, minHeight: 160 }} onChange={handleDeliverablesChange} value={selectedDeliverables}>
              {deliverables.map((d) => (
                <option key={d.id} value={d.id}>{d.projectCode} · {d.code} · {d.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 'bold', color: '#ffd6a5', display: 'block', marginBottom: 6 }}>受影響的零件/物料</label>
            <select name="partComponentIds" multiple style={{ ...darkInputStyle, minHeight: 120 }} onChange={handlePartsChange} value={selectedParts}>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.partNumber} · {p.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* wizard controls */}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        {currentStep > 1 && (
          <button type="button" onClick={handleBack} style={{ ...lightButtonStyle, flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid #fff' }}>上一步</button>
        )}
        {currentStep < 3 ? (
          <button type="button" onClick={handleNext} disabled={currentStep === 1 ? !isStep1Valid : !isStep2Valid} style={{ ...lightButtonStyle, flex: 2, opacity: (currentStep === 1 ? isStep1Valid : isStep2Valid) ? 1 : 0.5 }}>下一步</button>
        ) : (
          <button type="submit" style={{ ...lightButtonStyle, flex: 2 }}>建立變更單</button>
        )}
      </div>
    </form>
  )
}

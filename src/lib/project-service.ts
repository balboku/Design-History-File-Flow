import { ProjectPhase } from '@prisma/client'
import { recordAudit, AuditActions } from './audit-log-service'
import { prisma } from './prisma'

// ─── Phase Templates ──────────────────────────────────────────────────────────

export type TemplateType = 'None' | 'Standard' | 'SaMD'

interface TemplateDeliverable {
  code: string
  title: string
  description: string
  phase: ProjectPhase
  isRequired: boolean
}

export const PHASE_TEMPLATES: Record<Exclude<TemplateType, 'None'>, TemplateDeliverable[]> = {
  Standard: [
    { code: 'RM-001',  title: 'Risk Management Plan',        description: 'ISO 14971 風險管理計畫',        phase: ProjectPhase.Planning,        isRequired: true  },
    { code: 'SRS-001', title: 'Software Requirements Spec',  description: '軟體需求規格書 (若適用)',        phase: ProjectPhase.DesignInput,     isRequired: true  },
    { code: 'DWG-001', title: 'Drawing Pack',                description: '完整設計圖面集',               phase: ProjectPhase.DesignOutput,    isRequired: true  },
    { code: 'BOM-001', title: 'Bill of Materials',           description: '物料清單 (BoM)',               phase: ProjectPhase.DesignOutput,    isRequired: true  },
    { code: 'VP-001',  title: 'Verification Protocol',       description: '設計驗證計畫書',               phase: ProjectPhase.Verification,    isRequired: true  },
    { code: 'VR-001',  title: 'Verification Report',         description: '設計驗證報告',                 phase: ProjectPhase.Verification,    isRequired: true  },
    { code: 'VAL-001', title: 'Validation Plan',             description: '設計確效計畫書',               phase: ProjectPhase.Validation,      isRequired: true  },
    { code: 'DTR-001', title: 'Design Transfer Record',      description: '設計移轉紀錄 (21 CFR 820)',    phase: ProjectPhase.DesignTransfer,  isRequired: true  },
  ],
  SaMD: [
    { code: 'RM-001',   title: 'Risk Management Plan',          description: 'ISO 14971 + IEC 62304 風險管理計畫',  phase: ProjectPhase.Planning,        isRequired: true  },
    { code: 'SOUP-001', title: 'SOUP List',                     description: '第三方套件與軟體元件清單',            phase: ProjectPhase.Planning,        isRequired: true  },
    { code: 'CYB-001',  title: 'Cybersecurity Plan',            description: '醫療資安計畫 (FDA premarket)',        phase: ProjectPhase.Planning,        isRequired: true  },
    { code: 'SRS-001',  title: 'Software Requirements Spec',    description: 'IEC 62304 §5.2 軟體需求',            phase: ProjectPhase.DesignInput,     isRequired: true  },
    { code: 'IEC-001',  title: 'Software Architecture Document', description: 'IEC 62304 §5.3 架構設計',           phase: ProjectPhase.DesignOutput,    isRequired: true  },
    { code: 'BOM-001',  title: 'Bill of Materials',             description: '軟硬體物料清單',                    phase: ProjectPhase.DesignOutput,    isRequired: true  },
    { code: 'VP-001',   title: 'Verification Protocol',         description: '單元／整合測試計畫書',               phase: ProjectPhase.Verification,    isRequired: true  },
    { code: 'VR-001',   title: 'Verification Report',           description: '驗證報告 (含測試結果)',              phase: ProjectPhase.Verification,    isRequired: true  },
    { code: 'VAL-001',  title: 'Clinical / Usability Val Plan', description: '確效計畫 (含人因工程)',              phase: ProjectPhase.Validation,      isRequired: true  },
    { code: 'DTR-001',  title: 'Design Transfer Record',        description: '設計移轉紀錄',                      phase: ProjectPhase.DesignTransfer,  isRequired: true  },
  ],
}

// ─── Create Project ────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  code: string
  name: string
  description?: string
  currentPhase?: ProjectPhase
  ownerId?: string | null
  targetEndDate?: Date | null
  templateType?: TemplateType
}

export interface CreateProjectResult {
  project: {
    id: string
    code: string
    name: string
    currentPhase: ProjectPhase
  }
  deliverableCount: number
}

export async function createProject(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const code = input.code.trim()
  const name = input.name.trim()

  if (!code) throw new Error('Project code is required.')
  if (!name) throw new Error('Project name is required.')

  if (input.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: input.ownerId },
      select: { id: true },
    })
    if (!owner) throw new Error(`Project owner not found: ${input.ownerId}`)
  }

  const project = await prisma.project.create({
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      currentPhase: input.currentPhase ?? ProjectPhase.Concept,
      ownerId: input.ownerId ?? null,
      targetEndDate: input.targetEndDate ?? null,
    },
    select: { id: true, code: true, name: true, currentPhase: true },
  })

  await recordAudit({
    action: AuditActions.PROJECT_CREATE,
    entityType: 'Project',
    entityId: project.id,
    actorId: input.ownerId,
    projectId: project.id,
    detail: { code: project.code, name: project.name, currentPhase: project.currentPhase },
  })

  // ── Auto-create template deliverables ───────────────────────────────────────
  const templateKey = input.templateType ?? 'None'
  const templateItems = templateKey !== 'None' ? PHASE_TEMPLATES[templateKey] : []

  if (templateItems.length > 0) {
    // Batch create all deliverables in a single transaction
    await prisma.$transaction(
      templateItems.map((item) =>
        prisma.deliverablePlaceholder.create({
          data: {
            projectId: project.id,
            code: item.code,
            title: item.title,
            description: item.description,
            phase: item.phase,
            isRequired: item.isRequired,
          },
        }),
      ),
    )

    // Audit each created deliverable
    const created = await prisma.deliverablePlaceholder.findMany({
      where: { projectId: project.id },
      select: { id: true, code: true, phase: true },
    })

    await Promise.all(
      created.map((d) =>
        recordAudit({
          action: AuditActions.DELIVERABLE_CREATE,
          entityType: 'DeliverablePlaceholder',
          entityId: d.id,
          actorId: input.ownerId,
          projectId: project.id,
          detail: { code: d.code, phase: d.phase, projectId: project.id, auto: true, template: templateKey },
        }),
      ),
    )
  }

  return { project, deliverableCount: templateItems.length }
}

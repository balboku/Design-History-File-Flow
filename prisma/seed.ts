import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  ChangeRequestStatus,
  DeliverableStatus,
  PendingItemStatus,
  PrismaClient,
  ProjectPhase,
  Role,
  TaskStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

async function writeDemoStoredFile(storagePath: string, content: string) {
  const absolutePath = path.resolve(process.cwd(), storagePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
}

async function upsertUser(email: string, name: string, role: Role) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role },
  })
}

async function ensurePhaseTransition(input: {
  projectId: string
  fromPhase: ProjectPhase
  toPhase: ProjectPhase
  triggeredById?: string
  wasOverride?: boolean
  overrideReason?: string
}) {
  const existing = await prisma.phaseTransition.findFirst({
    where: {
      projectId: input.projectId,
      fromPhase: input.fromPhase,
      toPhase: input.toPhase,
      wasOverride: input.wasOverride ?? false,
    },
  })

  if (existing) {
    return existing
  }

  return prisma.phaseTransition.create({
    data: {
      projectId: input.projectId,
      fromPhase: input.fromPhase,
      toPhase: input.toPhase,
      triggeredById: input.triggeredById ?? null,
      wasOverride: input.wasOverride ?? false,
      overrideReason: input.overrideReason ?? null,
    },
  })
}

async function main() {
  const admin = await upsertUser('admin@dhfflow.local', 'Mira Chen', Role.ADMIN)
  const pm = await upsertUser('pm@dhfflow.local', 'Olivia Lin', Role.PM)
  const rd1 = await upsertUser('rd1@dhfflow.local', 'Leo Huang', Role.RD)
  const rd2 = await upsertUser('rd2@dhfflow.local', 'Ava Tsai', Role.RD)
  const qa = await upsertUser('qa@dhfflow.local', 'Hannah Wu', Role.QA)

  const housing = await prisma.partComponent.upsert({
    where: { partNumber: 'ME-1001' },
    update: { name: 'Sensor Housing', manufacturer: 'DemoFab' },
    create: {
      partNumber: 'ME-1001',
      name: 'Sensor Housing',
      manufacturer: 'DemoFab',
      description: 'Injection-molded enclosure for the wearable reader.',
    },
  })

  const pcb = await prisma.partComponent.upsert({
    where: { partNumber: 'EE-2207' },
    update: { name: 'Main Control PCB', manufacturer: 'CircuitSpring' },
    create: {
      partNumber: 'EE-2207',
      name: 'Main Control PCB',
      manufacturer: 'CircuitSpring',
      description: 'Primary control board with BLE and power regulation.',
    },
  })

  const alpha = await prisma.project.upsert({
    where: { code: 'DEMO-ALPHA' },
    update: {
      name: 'PulsePatch Wearable',
      description: 'Phase-independent execution demo with future-phase tasks already in motion.',
      currentPhase: ProjectPhase.DesignInput,
      previousPhase: ProjectPhase.Planning,
      ownerId: pm.id,
    },
    create: {
      code: 'DEMO-ALPHA',
      name: 'PulsePatch Wearable',
      description: 'Phase-independent execution demo with future-phase tasks already in motion.',
      currentPhase: ProjectPhase.DesignInput,
      previousPhase: ProjectPhase.Planning,
      ownerId: pm.id,
    },
  })

  const beta = await prisma.project.upsert({
    where: { code: 'DEMO-BETA' },
    update: {
      name: 'ScopeLite Analyzer',
      description: 'Soft-gate override demo carrying pending items toward the final hard gate.',
      currentPhase: ProjectPhase.Validation,
      previousPhase: ProjectPhase.Verification,
      ownerId: pm.id,
    },
    create: {
      code: 'DEMO-BETA',
      name: 'ScopeLite Analyzer',
      description: 'Soft-gate override demo carrying pending items toward the final hard gate.',
      currentPhase: ProjectPhase.Validation,
      previousPhase: ProjectPhase.Verification,
      ownerId: pm.id,
    },
  })

  const alphaInputPack = await prisma.deliverablePlaceholder.upsert({
    where: {
      projectId_code: {
        projectId: alpha.id,
        code: 'ALPHA-DI-001',
      },
    },
    update: {
      title: 'Design Input Package',
      phase: ProjectPhase.DesignInput,
      ownerId: qa.id,
      status: DeliverableStatus.Released,
      description: 'Product requirements, stakeholder needs, and user story trace bundle.',
    },
    create: {
      projectId: alpha.id,
      code: 'ALPHA-DI-001',
      title: 'Design Input Package',
      phase: ProjectPhase.DesignInput,
      ownerId: qa.id,
      status: DeliverableStatus.Released,
      description: 'Product requirements, stakeholder needs, and user story trace bundle.',
    },
  })

  const alphaOutputPack = await prisma.deliverablePlaceholder.upsert({
    where: {
      projectId_code: {
        projectId: alpha.id,
        code: 'ALPHA-DO-001',
      },
    },
    update: {
      title: 'Design Output Drawing Pack',
      phase: ProjectPhase.DesignOutput,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Mechanical drawings and firmware architecture package.',
    },
    create: {
      projectId: alpha.id,
      code: 'ALPHA-DO-001',
      title: 'Design Output Drawing Pack',
      phase: ProjectPhase.DesignOutput,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Mechanical drawings and firmware architecture package.',
    },
  })

  const alphaVerification = await prisma.deliverablePlaceholder.upsert({
    where: {
      projectId_code: {
        projectId: alpha.id,
        code: 'ALPHA-VER-001',
      },
    },
    update: {
      title: 'Verification Protocol',
      phase: ProjectPhase.Verification,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Future-phase verification protocol prepared ahead of formal promotion.',
    },
    create: {
      projectId: alpha.id,
      code: 'ALPHA-VER-001',
      title: 'Verification Protocol',
      phase: ProjectPhase.Verification,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Future-phase verification protocol prepared ahead of formal promotion.',
    },
  })

  const betaVerification = await prisma.deliverablePlaceholder.upsert({
    where: {
      projectId_code: {
        projectId: beta.id,
        code: 'BETA-VER-001',
      },
    },
    update: {
      title: 'Verification Test Report',
      phase: ProjectPhase.Verification,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Late verification report that triggered a managed soft-gate override.',
    },
    create: {
      projectId: beta.id,
      code: 'BETA-VER-001',
      title: 'Verification Test Report',
      phase: ProjectPhase.Verification,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Late verification report that triggered a managed soft-gate override.',
    },
  })

  const betaValidation = await prisma.deliverablePlaceholder.upsert({
    where: {
      projectId_code: {
        projectId: beta.id,
        code: 'BETA-VAL-001',
      },
    },
    update: {
      title: 'Clinical Validation Summary',
      phase: ProjectPhase.Validation,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Current-phase validation summary still under review.',
    },
    create: {
      projectId: beta.id,
      code: 'BETA-VAL-001',
      title: 'Clinical Validation Summary',
      phase: ProjectPhase.Validation,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Current-phase validation summary still under review.',
    },
  })

  const betaTransfer = await prisma.deliverablePlaceholder.upsert({
    where: {
      projectId_code: {
        projectId: beta.id,
        code: 'BETA-DT-001',
      },
    },
    update: {
      title: 'Design Transfer Packet',
      phase: ProjectPhase.DesignTransfer,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Final manufacturing handoff packet waiting on hard-gate closure.',
    },
    create: {
      projectId: beta.id,
      code: 'BETA-DT-001',
      title: 'Design Transfer Packet',
      phase: ProjectPhase.DesignTransfer,
      ownerId: qa.id,
      status: DeliverableStatus.Draft,
      description: 'Final manufacturing handoff packet waiting on hard-gate closure.',
    },
  })

  const alphaTask1 = await prisma.task.upsert({
    where: {
      projectId_code: {
        projectId: alpha.id,
        code: 'ALPHA-T-001',
      },
    },
    update: {
      title: 'Baseline user needs review',
      description: 'Close design input coverage before formal output promotion.',
      plannedPhase: ProjectPhase.DesignInput,
      status: TaskStatus.Done,
      assigneeId: rd1.id,
      createdById: pm.id,
      completedAt: new Date('2026-03-10T09:00:00.000Z'),
    },
    create: {
      projectId: alpha.id,
      code: 'ALPHA-T-001',
      title: 'Baseline user needs review',
      description: 'Close design input coverage before formal output promotion.',
      plannedPhase: ProjectPhase.DesignInput,
      status: TaskStatus.Done,
      assigneeId: rd1.id,
      createdById: pm.id,
      completedAt: new Date('2026-03-10T09:00:00.000Z'),
    },
  })

  const alphaTask2 = await prisma.task.upsert({
    where: {
      projectId_code: {
        projectId: alpha.id,
        code: 'ALPHA-T-002',
      },
    },
    update: {
      title: 'Pre-build firmware scaffolding',
      description: 'Future-phase code work started before the project formally advances.',
      plannedPhase: ProjectPhase.DesignOutput,
      status: TaskStatus.InProgress,
      assigneeId: rd2.id,
      createdById: pm.id,
      startedAt: new Date('2026-03-20T09:00:00.000Z'),
    },
    create: {
      projectId: alpha.id,
      code: 'ALPHA-T-002',
      title: 'Pre-build firmware scaffolding',
      description: 'Future-phase code work started before the project formally advances.',
      plannedPhase: ProjectPhase.DesignOutput,
      status: TaskStatus.InProgress,
      assigneeId: rd2.id,
      createdById: pm.id,
      startedAt: new Date('2026-03-20T09:00:00.000Z'),
    },
  })

  const alphaTask3 = await prisma.task.upsert({
    where: {
      projectId_code: {
        projectId: alpha.id,
        code: 'ALPHA-T-003',
      },
    },
    update: {
      title: 'Draft verification harness',
      description: 'Verification planning is visible in the system even though the project is earlier in the waterfall.',
      plannedPhase: ProjectPhase.Verification,
      status: TaskStatus.Todo,
      assigneeId: rd1.id,
      createdById: pm.id,
    },
    create: {
      projectId: alpha.id,
      code: 'ALPHA-T-003',
      title: 'Draft verification harness',
      description: 'Verification planning is visible in the system even though the project is earlier in the waterfall.',
      plannedPhase: ProjectPhase.Verification,
      status: TaskStatus.Todo,
      assigneeId: rd1.id,
      createdById: pm.id,
    },
  })

  const betaTask1 = await prisma.task.upsert({
    where: {
      projectId_code: {
        projectId: beta.id,
        code: 'BETA-T-001',
      },
    },
    update: {
      title: 'Validation execution wrap-up',
      description: 'Validation work is moving while prior verification evidence is still catching up.',
      plannedPhase: ProjectPhase.Validation,
      status: TaskStatus.InProgress,
      assigneeId: rd1.id,
      createdById: pm.id,
      startedAt: new Date('2026-03-22T09:00:00.000Z'),
    },
    create: {
      projectId: beta.id,
      code: 'BETA-T-001',
      title: 'Validation execution wrap-up',
      description: 'Validation work is moving while prior verification evidence is still catching up.',
      plannedPhase: ProjectPhase.Validation,
      status: TaskStatus.InProgress,
      assigneeId: rd1.id,
      createdById: pm.id,
      startedAt: new Date('2026-03-22T09:00:00.000Z'),
    },
  })

  const betaTask2 = await prisma.task.upsert({
    where: {
      projectId_code: {
        projectId: beta.id,
        code: 'BETA-T-002',
      },
    },
    update: {
      title: 'Manufacturing handoff package outline',
      description: 'Transfer planning starts early, but the final gate must still stay hard.',
      plannedPhase: ProjectPhase.DesignTransfer,
      status: TaskStatus.Todo,
      assigneeId: rd2.id,
      createdById: pm.id,
    },
    create: {
      projectId: beta.id,
      code: 'BETA-T-002',
      title: 'Manufacturing handoff package outline',
      description: 'Transfer planning starts early, but the final gate must still stay hard.',
      plannedPhase: ProjectPhase.DesignTransfer,
      status: TaskStatus.Todo,
      assigneeId: rd2.id,
      createdById: pm.id,
    },
  })

  await prisma.taskDeliverable.upsert({
    where: {
      taskId_deliverableId: {
        taskId: alphaTask1.id,
        deliverableId: alphaInputPack.id,
      },
    },
    update: {},
    create: {
      taskId: alphaTask1.id,
      deliverableId: alphaInputPack.id,
    },
  })

  await prisma.taskDeliverable.upsert({
    where: {
      taskId_deliverableId: {
        taskId: alphaTask2.id,
        deliverableId: alphaOutputPack.id,
      },
    },
    update: {},
    create: {
      taskId: alphaTask2.id,
      deliverableId: alphaOutputPack.id,
    },
  })

  await prisma.taskDeliverable.upsert({
    where: {
      taskId_deliverableId: {
        taskId: alphaTask3.id,
        deliverableId: alphaVerification.id,
      },
    },
    update: {},
    create: {
      taskId: alphaTask3.id,
      deliverableId: alphaVerification.id,
    },
  })

  await prisma.taskDeliverable.upsert({
    where: {
      taskId_deliverableId: {
        taskId: betaTask1.id,
        deliverableId: betaValidation.id,
      },
    },
    update: {},
    create: {
      taskId: betaTask1.id,
      deliverableId: betaValidation.id,
    },
  })

  await prisma.taskDeliverable.upsert({
    where: {
      taskId_deliverableId: {
        taskId: betaTask2.id,
        deliverableId: betaTransfer.id,
      },
    },
    update: {},
    create: {
      taskId: betaTask2.id,
      deliverableId: betaTransfer.id,
    },
  })

  await prisma.fileRevision.upsert({
    where: {
      deliverableId_revisionNumber: {
        deliverableId: alphaInputPack.id,
        revisionNumber: 1,
      },
    },
    update: {
      fileName: 'alpha-design-input-v1.txt',
      storagePath: 'storage/revisions/demo-alpha/ALPHA-DI-001/r001-alpha-design-input-v1.txt',
      uploadedById: qa.id,
      mimeType: 'text/plain',
    },
    create: {
      deliverableId: alphaInputPack.id,
      revisionNumber: 1,
      fileName: 'alpha-design-input-v1.txt',
      storagePath: 'storage/revisions/demo-alpha/ALPHA-DI-001/r001-alpha-design-input-v1.txt',
      uploadedById: qa.id,
      mimeType: 'text/plain',
      changeSummary: 'Initial released design input bundle.',
    },
  })

  await writeDemoStoredFile(
    'storage/revisions/demo-alpha/ALPHA-DI-001/r001-alpha-design-input-v1.txt',
    'Demo Alpha Design Input Package\n\nThis is a seeded local file for download testing.',
  )

  await prisma.fileRevision.upsert({
    where: {
      deliverableId_revisionNumber: {
        deliverableId: alphaOutputPack.id,
        revisionNumber: 1,
      },
    },
    update: {
      fileName: 'alpha-output-pack-r1.txt',
      storagePath: 'storage/revisions/demo-alpha/ALPHA-DO-001/r001-alpha-output-pack-r1.txt',
      uploadedById: rd2.id,
      mimeType: 'text/plain',
    },
    create: {
      deliverableId: alphaOutputPack.id,
      revisionNumber: 1,
      fileName: 'alpha-output-pack-r1.txt',
      storagePath: 'storage/revisions/demo-alpha/ALPHA-DO-001/r001-alpha-output-pack-r1.txt',
      uploadedById: rd2.id,
      mimeType: 'text/plain',
      changeSummary: 'Early engineering output draft uploaded before formal promotion.',
    },
  })

  await writeDemoStoredFile(
    'storage/revisions/demo-alpha/ALPHA-DO-001/r001-alpha-output-pack-r1.txt',
    'Demo Alpha Design Output Draft\n\nSeeded local file to exercise revision download.',
  )

  await prisma.fileRevision.upsert({
    where: {
      deliverableId_revisionNumber: {
        deliverableId: betaValidation.id,
        revisionNumber: 1,
      },
    },
    update: {
      fileName: 'beta-validation-summary-r1.txt',
      storagePath: 'storage/revisions/demo-beta/BETA-VAL-001/r001-beta-validation-summary-r1.txt',
      uploadedById: rd1.id,
      mimeType: 'text/plain',
    },
    create: {
      deliverableId: betaValidation.id,
      revisionNumber: 1,
      fileName: 'beta-validation-summary-r1.txt',
      storagePath: 'storage/revisions/demo-beta/BETA-VAL-001/r001-beta-validation-summary-r1.txt',
      uploadedById: rd1.id,
      mimeType: 'text/plain',
      changeSummary: 'Current validation evidence package under QA review.',
    },
  })

  await writeDemoStoredFile(
    'storage/revisions/demo-beta/BETA-VAL-001/r001-beta-validation-summary-r1.txt',
    'Demo Beta Validation Summary\n\nSeeded local file for pending-item and download testing.',
  )

  const alphaTransition = await ensurePhaseTransition({
    projectId: alpha.id,
    fromPhase: ProjectPhase.Planning,
    toPhase: ProjectPhase.DesignInput,
    triggeredById: pm.id,
  })

  const betaTransition = await ensurePhaseTransition({
    projectId: beta.id,
    fromPhase: ProjectPhase.Verification,
    toPhase: ProjectPhase.Validation,
    triggeredById: pm.id,
    wasOverride: true,
    overrideReason: 'Validation execution needed to begin while verification report cleanup continued.',
  })

  await prisma.pendingItem.upsert({
    where: {
      projectId_deliverableId: {
        projectId: beta.id,
        deliverableId: betaVerification.id,
      },
    },
    update: {
      title: 'Complete late verification report',
      detail: 'Soft-gate override created this action item; it must close before design transfer.',
      status: PendingItemStatus.Open,
      resolvedAt: null,
      sourceTransitionId: betaTransition.id,
    },
    create: {
      projectId: beta.id,
      deliverableId: betaVerification.id,
      sourceTransitionId: betaTransition.id,
      title: 'Complete late verification report',
      detail: 'Soft-gate override created this action item; it must close before design transfer.',
      status: PendingItemStatus.Open,
    },
  })

  const alphaCr = await prisma.changeRequest.upsert({
    where: { code: 'CR-ALPHA-001' },
    update: {
      projectId: alpha.id,
      title: 'Housing vent geometry update',
      description: 'Adjust enclosure venting to reduce thermal rise during continuous sampling.',
      status: ChangeRequestStatus.InReview,
      requesterId: qa.id,
      impactAnalysis: {
        upsert: {
          update: {
            summary: 'Mechanical drawing pack, BOM notes, and firmware enclosure assumptions require review.',
            regulatoryImpact: 'Design output references and trace links need QA review.',
            productRiskImpact: 'Enclosure vent geometry may affect temperature and particulate ingress risk.',
            verificationImpact: 'Thermal verification protocol and acceptance rationale need refresh.',
            manufacturingImpact: 'Tooling notes and assembly instructions need to reflect the vent change.',
            documentationImpact: 'Drawing pack, BOM notes, and release checklist need revision.',
          },
          create: {
            summary: 'Mechanical drawing pack, BOM notes, and firmware enclosure assumptions require review.',
            regulatoryImpact: 'Design output references and trace links need QA review.',
            productRiskImpact: 'Enclosure vent geometry may affect temperature and particulate ingress risk.',
            verificationImpact: 'Thermal verification protocol and acceptance rationale need refresh.',
            manufacturingImpact: 'Tooling notes and assembly instructions need to reflect the vent change.',
            documentationImpact: 'Drawing pack, BOM notes, and release checklist need revision.',
          },
        },
      },
    },
    create: {
      code: 'CR-ALPHA-001',
      projectId: alpha.id,
      title: 'Housing vent geometry update',
      description: 'Adjust enclosure venting to reduce thermal rise during continuous sampling.',
      status: ChangeRequestStatus.InReview,
      requesterId: qa.id,
      impactAnalysis: {
        create: {
          summary: 'Mechanical drawing pack, BOM notes, and firmware enclosure assumptions require review.',
          regulatoryImpact: 'Design output references and trace links need QA review.',
          productRiskImpact: 'Enclosure vent geometry may affect temperature and particulate ingress risk.',
          verificationImpact: 'Thermal verification protocol and acceptance rationale need refresh.',
          manufacturingImpact: 'Tooling notes and assembly instructions need to reflect the vent change.',
          documentationImpact: 'Drawing pack, BOM notes, and release checklist need revision.',
        },
      },
    },
  })

  const betaCr = await prisma.changeRequest.upsert({
    where: { code: 'CR-BETA-001' },
    update: {
      projectId: beta.id,
      title: 'Controller PCB component alternates',
      description: 'Approve an alternate regulator network for transfer readiness.',
      status: ChangeRequestStatus.Approved,
      requesterId: pm.id,
      approverId: admin.id,
      approvedAt: new Date('2026-03-25T08:00:00.000Z'),
      impactAnalysis: {
        upsert: {
          update: {
            summary: 'Supplier swap affects PCB assembly notes, verification rationale, and transfer packet attachments.',
            regulatoryImpact: 'Transfer packet references and approved supplier records require update.',
            productRiskImpact: 'Alternate regulator network needs documented equivalence review.',
            verificationImpact: 'Verification rationale and any delta evidence must cite the approved alternate.',
            manufacturingImpact: 'PCB assembly instructions and AVL entries need synchronized release.',
            documentationImpact: 'Transfer packet attachments and BOM exports need new version references.',
          },
          create: {
            summary: 'Supplier swap affects PCB assembly notes, verification rationale, and transfer packet attachments.',
            regulatoryImpact: 'Transfer packet references and approved supplier records require update.',
            productRiskImpact: 'Alternate regulator network needs documented equivalence review.',
            verificationImpact: 'Verification rationale and any delta evidence must cite the approved alternate.',
            manufacturingImpact: 'PCB assembly instructions and AVL entries need synchronized release.',
            documentationImpact: 'Transfer packet attachments and BOM exports need new version references.',
          },
        },
      },
    },
    create: {
      code: 'CR-BETA-001',
      projectId: beta.id,
      title: 'Controller PCB component alternates',
      description: 'Approve an alternate regulator network for transfer readiness.',
      status: ChangeRequestStatus.Approved,
      requesterId: pm.id,
      approverId: admin.id,
      approvedAt: new Date('2026-03-25T08:00:00.000Z'),
      impactAnalysis: {
        create: {
          summary: 'Supplier swap affects PCB assembly notes, verification rationale, and transfer packet attachments.',
          regulatoryImpact: 'Transfer packet references and approved supplier records require update.',
          productRiskImpact: 'Alternate regulator network needs documented equivalence review.',
          verificationImpact: 'Verification rationale and any delta evidence must cite the approved alternate.',
          manufacturingImpact: 'PCB assembly instructions and AVL entries need synchronized release.',
          documentationImpact: 'Transfer packet attachments and BOM exports need new version references.',
        },
      },
    },
  })

  await prisma.changeRequestDeliverable.upsert({
    where: {
      changeRequestId_deliverableId: {
        changeRequestId: alphaCr.id,
        deliverableId: alphaOutputPack.id,
      },
    },
    update: {},
    create: {
      changeRequestId: alphaCr.id,
      deliverableId: alphaOutputPack.id,
    },
  })

  await prisma.changeRequestDeliverable.upsert({
    where: {
      changeRequestId_deliverableId: {
        changeRequestId: betaCr.id,
        deliverableId: betaTransfer.id,
      },
    },
    update: {},
    create: {
      changeRequestId: betaCr.id,
      deliverableId: betaTransfer.id,
    },
  })

  await prisma.changeRequestPartComponent.upsert({
    where: {
      changeRequestId_partComponentId: {
        changeRequestId: alphaCr.id,
        partComponentId: housing.id,
      },
    },
    update: {},
    create: {
      changeRequestId: alphaCr.id,
      partComponentId: housing.id,
    },
  })

  await prisma.changeRequestPartComponent.upsert({
    where: {
      changeRequestId_partComponentId: {
        changeRequestId: betaCr.id,
        partComponentId: pcb.id,
      },
    },
    update: {},
    create: {
      changeRequestId: betaCr.id,
      partComponentId: pcb.id,
    },
  })

  await prisma.fileRevision.upsert({
    where: {
      deliverableId_revisionNumber: {
        deliverableId: betaTransfer.id,
        revisionNumber: 1,
      },
    },
    update: {
      fileName: 'beta-transfer-packet-r1.txt',
      storagePath: 'storage/revisions/demo-beta/BETA-DT-001/r001-beta-transfer-packet-r1.txt',
      uploadedById: qa.id,
      changeRequestId: betaCr.id,
      mimeType: 'text/plain',
    },
    create: {
      deliverableId: betaTransfer.id,
      revisionNumber: 1,
      fileName: 'beta-transfer-packet-r1.txt',
      storagePath: 'storage/revisions/demo-beta/BETA-DT-001/r001-beta-transfer-packet-r1.txt',
      uploadedById: qa.id,
      changeRequestId: betaCr.id,
      mimeType: 'text/plain',
      changeSummary: 'Initial transfer packet linked to approved component alternate CR.',
    },
  })

  await writeDemoStoredFile(
    'storage/revisions/demo-beta/BETA-DT-001/r001-beta-transfer-packet-r1.txt',
    'Demo Beta Design Transfer Packet\n\nSeeded local file linked to an approved change request.',
  )

  console.log('Demo seed complete.')
  console.log(`Projects: ${alpha.code}, ${beta.code}`)
  console.log(`Phase transitions: ${alphaTransition.id}, ${betaTransition.id}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

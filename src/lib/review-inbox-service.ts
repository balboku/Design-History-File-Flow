import { DeliverableStatus, ChangeRequestStatus } from '@prisma/client'
import { prisma } from './prisma'

export interface InboxDeliverable {
  id: string
  code: string
  title: string
  projectId: string
  projectCode: string
  projectName: string
  latestRevisionId: string | null
  latestRevisionFileName: string | null
  submittedAt: Date | null
}

export interface InboxChangeRequest {
  id: string
  code: string
  title: string
  projectCode: string | null
  requesterName: string | null
  submittedAt: Date | null
  impactSummary: string | null
}

export interface ReviewInboxData {
  deliverables: InboxDeliverable[]
  changeRequests: InboxChangeRequest[]
}

export async function getReviewInboxData(): Promise<ReviewInboxData> {
  const [inReviewDeliverables, submittedCRs] = await Promise.all([
    prisma.deliverablePlaceholder.findMany({
      where: {
        status: DeliverableStatus.InReview,
      },
      include: {
        project: {
          select: { code: true, name: true },
        },
        fileRevisions: {
          orderBy: { revisionNumber: 'desc' },
          take: 1,
          select: { id: true, fileName: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.changeRequest.findMany({
      where: {
        status: ChangeRequestStatus.Submitted,
      },
      include: {
        project: {
          select: { code: true },
        },
        requester: {
          select: { name: true },
        },
        impactAnalysis: {
          select: { summary: true },
        },
      },
      orderBy: { submittedAt: 'asc' },
    }),
  ])

  return {
    deliverables: inReviewDeliverables.map((d) => ({
      id: d.id,
      code: d.code,
      title: d.title,
      projectId: d.projectId,
      projectCode: d.project.code,
      projectName: d.project.name,
      latestRevisionId: d.fileRevisions[0]?.id ?? null,
      latestRevisionFileName: d.fileRevisions[0]?.fileName ?? null,
      submittedAt: d.updatedAt, // Using updatedAt as proxy for when it was set to InReview
    })),
    changeRequests: submittedCRs.map((cr) => ({
      id: cr.id,
      code: cr.code,
      title: cr.title,
      projectCode: cr.project?.code ?? null,
      requesterName: cr.requester?.name ?? null,
      submittedAt: cr.submittedAt,
      impactSummary: cr.impactAnalysis?.summary ?? null,
    })),
  }
}

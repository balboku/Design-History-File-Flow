import { NextResponse } from 'next/server'

import {
  createUploadedFileRevision,
  LOCKED_DELIVERABLE_APPROVED_CHANGE_REQUEST_ERROR,
  LOCKED_DELIVERABLE_CHANGE_REQUEST_LINK_ERROR,
  FILE_UPLOAD_ERROR,
  LOCKED_DELIVERABLE_CHANGE_REQUEST_ERROR,
} from '@/lib/deliverable-service'

function buildProjectRedirectUrl(
  request: Request,
  projectId: string,
  params: { notice?: string; error?: string },
) {
  const url = new URL(`/projects/${projectId}`, request.url)

  if (params.notice) {
    url.searchParams.set('notice', params.notice)
  }

  if (params.error) {
    url.searchParams.set('error', params.error)
  }

  return url
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; deliverableId: string }> },
) {
  const { projectId, deliverableId } = await context.params

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const revisionNumber = String(formData.get('revisionNumber') ?? '')

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.redirect(
        buildProjectRedirectUrl(request, projectId, { error: FILE_UPLOAD_ERROR }),
        303,
      )
    }

    const result = await createUploadedFileRevision({
      deliverableId,
      file,
      uploadedById: String(formData.get('uploadedById') ?? '') || undefined,
      changeRequestId: String(formData.get('changeRequestId') ?? '') || undefined,
      changeSummary: String(formData.get('changeSummary') ?? '') || undefined,
      revisionNumber: revisionNumber ? Number(revisionNumber) : undefined,
    })

    return NextResponse.redirect(
      buildProjectRedirectUrl(request, projectId, {
        notice: `Revision r${result.revision.revisionNumber} uploaded for ${result.revision.fileName}`,
      }),
      303,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const safeMessage =
      message === LOCKED_DELIVERABLE_CHANGE_REQUEST_ERROR ||
      message === LOCKED_DELIVERABLE_APPROVED_CHANGE_REQUEST_ERROR ||
      message === LOCKED_DELIVERABLE_CHANGE_REQUEST_LINK_ERROR ||
      message === FILE_UPLOAD_ERROR
        ? message
        : `Revision upload failed: ${message}`

    return NextResponse.redirect(
      buildProjectRedirectUrl(request, projectId, { error: safeMessage }),
      303,
    )
  }
}

import { NextResponse } from 'next/server'
import { createUploadedFileRevision } from '@/lib/deliverable-service'
import { completeTask, TASK_COMPLETION_ERROR, TASK_NOT_IN_PROGRESS_ERROR } from '@/lib/task-service'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const uploadedById = String(formData.get('uploadedById') ?? '')
    const changeSummary = String(formData.get('changeSummary') ?? '') || undefined

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ success: false, error: '請選擇一個有效的檔案。' }, { status: 400 })
    }

    if (!uploadedById) {
      return NextResponse.json({ success: false, error: '必須指定上傳者。' }, { status: 400 })
    }

    // 1. Find the task and all linked deliverables that are missing FileRevisions
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        deliverableLinks: {
          include: {
            deliverable: {
              include: {
                fileRevisions: {
                  where: { changeRequestId: null },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ success: false, error: `Task not found: ${taskId}` }, { status: 404 })
    }

    const missingLinks = task.deliverableLinks.filter(
      (link) => link.deliverable.fileRevisions.length === 0,
    )

    // 2. Upload the file to ALL deliverables that are missing a FileRevision
    //    in sequence to satisfy the compliance guard
    for (const link of missingLinks) {
      await createUploadedFileRevision({
        deliverableId: link.deliverable.id,
        file,
        uploadedById,
        changeSummary,
      })
    }

    // 3. Now complete the task (backend guard will pass as all deliverables have revisions)
    const result = await completeTask(taskId)

    return NextResponse.json({ success: true, data: result.task })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isFileMissingError = message.startsWith(TASK_COMPLETION_ERROR)
    const isNotInProgressError = message === TASK_NOT_IN_PROGRESS_ERROR
    return NextResponse.json(
      { success: false, error: message, isFileMissingError, isNotInProgressError },
      { status: 422 },
    )
  }
}

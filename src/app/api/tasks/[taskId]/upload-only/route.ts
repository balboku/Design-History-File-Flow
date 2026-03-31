import { NextResponse } from 'next/server'
import { createUploadedFileRevision } from '@/lib/deliverable-service'
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

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        deliverableLinks: {
          select: { deliverableId: true }
        }
      },
    })

    if (!task) {
      return NextResponse.json({ success: false, error: `Task not found: ${taskId}` }, { status: 404 })
    }

    // Upload to ALL linked deliverables
    for (const link of task.deliverableLinks) {
      await createUploadedFileRevision({
        deliverableId: link.deliverableId,
        file,
        uploadedById,
        changeSummary,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: message },
      { status: 422 },
    )
  }
}

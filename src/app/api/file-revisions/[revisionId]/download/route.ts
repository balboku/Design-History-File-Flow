import { NextResponse } from 'next/server'

import { getStoredFileRevision } from '@/lib/deliverable-service'

function toAsciiFileName(fileName: string) {
  return fileName.replace(/[^\x20-\x7E]+/g, '_')
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ revisionId: string }> },
) {
  try {
    const { revisionId } = await context.params
    const revision = await getStoredFileRevision(revisionId)
    const asciiFileName = toAsciiFileName(revision.fileName)
    const body = new Uint8Array(revision.content)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': revision.mimeType || 'application/octet-stream',
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(revision.fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes('not found') ? 404 : 400

    return NextResponse.json({ success: false, error: message }, { status })
  }
}

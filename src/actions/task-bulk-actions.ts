'use server'

import { prisma } from '@/lib/prisma'
import { recordAudit, AuditActions } from '@/lib/audit-log-service'
import { ProjectPhase, TaskStatus } from '@prisma/client'

// 使用 require 來導入 xlsx，以支援 server action
const XLSX = require('xlsx')

// ─── Types ────────────────────────────────────────────────────────────────

export interface ExportTasksResult {
  success: boolean
  data?: string // Base64 encoded Excel buffer
  error?: string
}

export interface ImportTasksResult {
  success: boolean
  count?: number
  error?: string
  details?: {
    created: number
    failed: number
    errors: Array<{ row: number; message: string }>
  }
}

interface ExcelTaskRow {
  code?: string
  title?: string
  description?: string
  plannedPhase?: string
  assigneeEmail?: string
  plannedStartDate?: string
  targetDate?: string
  deliverableCodes?: string
  blockedByCodes?: string
}

// ─── Export Tasks to Excel ────────────────────────────────────────────────

/**
 * 將專案下的所有 Task 匯出成 Excel 格式（Base64 編碼）。
 * Excel 欄位：code, title, description, plannedPhase, assigneeEmail,
 * plannedStartDate (YYYY-MM-DD), targetDate (YYYY-MM-DD),
 * deliverableCodes (comma-separated), blockedByCodes (comma-separated)
 */
export async function exportTasksToExcelAction(projectId: string): Promise<ExportTasksResult> {
  try {
    // 驗證 project 存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!project) {
      return { success: false, error: `Project not found: ${projectId}` }
    }

    // 撈取所有 Task 及其關聯資料
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: { email: true },
        },
        deliverableLinks: {
          include: {
            deliverable: {
              select: { code: true },
            },
          },
        },
        blockedBy: {
          select: { code: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 轉換成 Excel 資料格式
    const excelRows: Array<Record<string, unknown>> = tasks.map((task) => ({
      '任務代碼': task.code,
      '標題': task.title,
      '描述': task.description || '',
      '規劃階段': task.plannedPhase,
      '負責人信箱': task.assignee?.email || '',
      '預計開始日': task.plannedStartDate
        ? task.plannedStartDate.toISOString().split('T')[0]
        : '',
      '預計完成日': task.targetDate ? task.targetDate.toISOString().split('T')[0] : '',
      '綁定文件代碼': task.deliverableLinks
        .map((link) => link.deliverable.code)
        .join(', '),
      '前置任務代碼': task.blockedBy.map((t) => t.code).join(', '),
    }))

    // 使用 xlsx 建立 workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelRows)

    // 設定欄寬以提升可讀性
    const colWidths = [
      { wch: 12 }, // 任務代碼
      { wch: 20 }, // 標題
      { wch: 30 }, // 描述
      { wch: 12 }, // 規劃階段
      { wch: 20 }, // 負責人信箱
      { wch: 14 }, // 預計開始日
      { wch: 14 }, // 預計完成日
      { wch: 25 }, // 綁定文件代碼
      { wch: 25 }, // 前置任務代碼
    ]
    worksheet['!cols'] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks')

    // 生成 Buffer 並轉換為 Base64
    const buffer = XLSX.write(workbook, { type: 'buffer' })
    const base64Data = buffer.toString('base64')

    return {
      success: true,
      data: base64Data,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Export failed: ${message}` }
  }
}

// ─── Import Tasks from Excel ──────────────────────────────────────────────

/**
 * 從上傳的 Excel 檔案匯入 Task。
 * 流程：
 * 1. 解析 Excel 檔案
 * 2. 驗證必填欄位與關聯訊息
 * 3. 在 transaction 中批次建立 Task 與相關關聯
 * 4. 為每個建立的 Task 寫入 AuditLog
 */
export async function importTasksFromExcelAction(
  projectId: string,
  formData: FormData,
  actorId: string,
): Promise<ImportTasksResult> {
  const errors: Array<{ row: number; message: string }> = []
  let created = 0

  try {
    // 驗證 project 存在
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, code: true },
    })

    if (!project) {
      return { success: false, error: `Project not found: ${projectId}` }
    }

    // 取得上傳的 Excel 檔案
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return { success: false, error: 'No Excel file provided' }
    }

    // 讀取 Excel 檔案
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    if (!workbook.SheetNames.length) {
      return { success: false, error: 'Excel file has no sheets' }
    }

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as Array<unknown[]>

    if (!Array.isArray(rows) || rows.length < 2) {
      return { success: false, error: 'Excel file has no data rows' }
    }

    const headerRow = rows[0] as string[]
    const dataRows = rows.slice(1) as (string | number | undefined)[][]

    // 尋找欄位索引
    const findColumnIndex = (name: string): number => {
      const index = headerRow.findIndex((h) =>
        h?.toString().toLowerCase().includes(name.toLowerCase()),
      )
      return index
    }

    const codeIdx = findColumnIndex('任務代碼')
    const titleIdx = findColumnIndex('標題')
    const descriptionIdx = findColumnIndex('描述')
    const plannedPhaseIdx = findColumnIndex('規劃階段')
    const assigneeEmailIdx = findColumnIndex('負責人信箱')
    const plannedStartDateIdx = findColumnIndex('預計開始日')
    const targetDateIdx = findColumnIndex('預計完成日')
    const deliverableCodesIdx = findColumnIndex('綁定文件代碼')
    const blockedByCodesIdx = findColumnIndex('前置任務代碼')

    // 驗證必填欄位
    if (
      codeIdx === -1 ||
      titleIdx === -1 ||
      plannedPhaseIdx === -1 ||
      deliverableCodesIdx === -1
    ) {
      return {
        success: false,
        error: 'Missing required columns: 任務代碼, 標題, 規劃階段, 綁定文件代碼',
      }
    }

    // 預先載入關聯資料以提高效率
    const users = await prisma.user.findMany({
      where: { role: { in: ['RD', 'QA', 'PM', 'ADMIN'] } },
      select: { id: true, email: true },
    })
    const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]))

    const deliverables = await prisma.deliverablePlaceholder.findMany({
      where: { projectId },
      select: { id: true, code: true },
    })
    const deliverableMap = new Map(deliverables.map((d) => [d.code, d.id]))

    const existingTasks = await prisma.task.findMany({
      where: { projectId },
      select: { id: true, code: true },
    })
    const taskMap = new Map(existingTasks.map((t) => [t.code, t.id]))

    // 驗證與準備資料
    const tasksToCreate: Array<{
      code: string
      title: string
      description?: string
      plannedPhase: ProjectPhase
      assigneeId?: string
      deliverableIds: string[]
      blockedByIds: string[]
      plannedStartDate?: Date
      targetDate?: Date
    }> = []

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx]
      const rowNumber = rowIdx + 2 // +2 because of header and 0-indexing

      try {
        const code = row[codeIdx]?.toString().trim()
        const title = row[titleIdx]?.toString().trim()
        const description = row[descriptionIdx]?.toString().trim() || undefined
        const plannedPhaseStr = row[plannedPhaseIdx]?.toString().trim()
        const assigneeEmail = row[assigneeEmailIdx]?.toString().trim() || ''
        const plannedStartDateStr = row[plannedStartDateIdx]?.toString().trim() || ''
        const targetDateStr = row[targetDateIdx]?.toString().trim() || ''
        const deliverableCodesStr = row[deliverableCodesIdx]?.toString().trim() || ''
        const blockedByCodesStr = row[blockedByCodesIdx]?.toString().trim() || ''

        // 驗證必填欄位
        if (!code) {
          errors.push({ row: rowNumber, message: '任務代碼必填' })
          continue
        }

        if (!title) {
          errors.push({ row: rowNumber, message: `${code}: 標題必填` })
          continue
        }

        if (!plannedPhaseStr) {
          errors.push({ row: rowNumber, message: `${code}: 規劃階段必填` })
          continue
        }

        // 驗證 plannedPhase 是否有效
        const validPhases = Object.values(ProjectPhase)
        if (!validPhases.includes(plannedPhaseStr as ProjectPhase)) {
          errors.push({
            row: rowNumber,
            message: `${code}: 無效的規劃階段 '${plannedPhaseStr}'。有效值: ${validPhases.join(', ')}`,
          })
          continue
        }

        // 檢查 Task code 是否已存在
        if (taskMap.has(code)) {
          errors.push({ row: rowNumber, message: `${code}: 任務代碼已存在於專案中` })
          continue
        }

        // 解析 deliverable codes
        if (!deliverableCodesStr) {
          errors.push({
            row: rowNumber,
            message: `${code}: 綁定文件代碼必填（合規要求）`,
          })
          continue
        }

        const deliverableCodes = deliverableCodesStr
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)

        if (deliverableCodes.length === 0) {
          errors.push({
            row: rowNumber,
            message: `${code}: 綁定文件代碼必填（合規要求）`,
          })
          continue
        }

        const deliverableIds: string[] = []
        for (const delCode of deliverableCodes) {
          const delId = deliverableMap.get(delCode)
          if (!delId) {
            errors.push({
              row: rowNumber,
              message: `${code}: 找不到文件代碼 '${delCode}'`,
            })
            continue
          }
          deliverableIds.push(delId)
        }

        if (deliverableIds.length !== deliverableCodes.length) {
          // 有缺失的文件，已在上面記錄錯誤
          continue
        }

        // 解析 assignee
        let assigneeId: string | undefined
        if (assigneeEmail) {
          assigneeId = userMap.get(assigneeEmail.toLowerCase())
          if (!assigneeId) {
            errors.push({
              row: rowNumber,
              message: `${code}: 找不到用戶信箱 '${assigneeEmail}'`,
            })
            continue
          }
        }

        // 解析日期
        let plannedStartDate: Date | undefined
        if (plannedStartDateStr) {
          const date = parseDate(plannedStartDateStr)
          if (!date) {
            errors.push({
              row: rowNumber,
              message: `${code}: 無效的預計開始日格式 (需要 YYYY-MM-DD)`,
            })
            continue
          }
          plannedStartDate = date
        }

        let targetDate: Date | undefined
        if (targetDateStr) {
          const date = parseDate(targetDateStr)
          if (!date) {
            errors.push({
              row: rowNumber,
              message: `${code}: 無效的預計完成日格式 (需要 YYYY-MM-DD)`,
            })
            continue
          }
          targetDate = date
        }

        // 解析 blockedBy codes
        const blockedByIds: string[] = []
        if (blockedByCodesStr) {
          const blockedCodes = blockedByCodesStr
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)

          for (const blockedCode of blockedCodes) {
            const blockedId = taskMap.get(blockedCode)
            if (!blockedId) {
              errors.push({
                row: rowNumber,
                message: `${code}: 找不到前置任務代碼 '${blockedCode}'`,
              })
              continue
            }
            blockedByIds.push(blockedId)
          }

          if (blockedByIds.length !== blockedCodes.length) {
            // 有缺失的前置任務，已在上面記錄錯誤
            continue
          }
        }

        // 新增至待建立列表
        tasksToCreate.push({
          code,
          title,
          description,
          plannedPhase: plannedPhaseStr as ProjectPhase,
          assigneeId,
          deliverableIds,
          blockedByIds,
          plannedStartDate,
          targetDate,
        })

        // 更新 taskMap 以支援後續行的 blockedBy 參考
        taskMap.set(code, `_new_${tasksToCreate.length - 1}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push({ row: rowNumber, message: `解析錯誤: ${message}` })
      }
    }

    if (tasksToCreate.length === 0) {
      return {
        success: false,
        error: 'No valid tasks to import',
        details: {
          created: 0,
          failed: errors.length,
          errors,
        },
      }
    }

    // 使用 transaction 批次建立 Task
    try {
      const createdTasks = await prisma.$transaction(async (tx) => {
        const results = []

        for (const taskData of tasksToCreate) {
          // 解析 blockedByIds：如果參考新建立的 task，需要使用真實 ID
          const finalBlockedByIds: string[] = []
          for (const blockId of taskData.blockedByIds) {
            if (blockId.startsWith('_new_')) {
              // 這是新建立的 task 的參考，取得其真實 ID
              const index = parseInt(blockId.split('_')[2], 10)
              if (index < results.length) {
                finalBlockedByIds.push(results[index].id)
              }
            } else {
              // 這是現有 task 的 ID
              finalBlockedByIds.push(blockId)
            }
          }

          const task = await tx.task.create({
            data: {
              projectId,
              code: taskData.code,
              title: taskData.title,
              description: taskData.description ?? null,
              plannedPhase: taskData.plannedPhase,
              status: TaskStatus.Todo,
              assigneeId: taskData.assigneeId ?? null,
              createdById: actorId ?? null,
              plannedStartDate: taskData.plannedStartDate ?? null,
              targetDate: taskData.targetDate ?? null,
              deliverableLinks: {
                create: taskData.deliverableIds.map((deliverableId) => ({
                  deliverableId,
                })),
              },
              blockedBy: finalBlockedByIds.length
                ? { connect: finalBlockedByIds.map((id) => ({ id })) }
                : undefined,
            },
            include: {
              deliverableLinks: {
                select: { deliverableId: true },
              },
            },
          })

          // 寫入審核日誌
          await recordAudit(
            {
              action: AuditActions.TASK_CREATE,
              entityType: 'Task',
              entityId: task.id,
              actorId,
              projectId,
              detail: {
                code: task.code,
                source: 'bulk_import',
                deliverableIds: taskData.deliverableIds,
              },
            },
            tx,
          )

          results.push(task)
          created++
        }

        return results
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        error: `Transaction failed: ${message}`,
        details: {
          created: 0, // 交易回滾，實際上沒有任務被建立
          failed: tasksToCreate.length,
          errors: [
            {
              row: 0,
              message: `無法完成批次建立: ${message}`,
            },
          ],
        },
      }
    }

    return {
      success: true,
      count: created,
      details: {
        created,
        failed: errors.length,
        errors: errors.length > 0 ? errors : [],
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Import failed: ${message}`,
      details: {
        created,
        failed: errors.length,
        errors,
      },
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * 解析 YYYY-MM-DD 格式的日期字符串。
 */
function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`)

  if (isNaN(date.getTime())) {
    return null
  }

  return date
}

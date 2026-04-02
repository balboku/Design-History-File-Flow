/**
 * 前端使用範例：Excel 匯入匯出
 *
 * 此文件展示如何在 React 客戶端元件中使用 task-bulk-actions。
 * 實際使用時，將代碼整合到您的專案元件中。
 */

'use client'

import { exportTasksToExcelAction, importTasksFromExcelAction } from '@/actions/task-bulk-actions'
import { useRef } from 'react'

export function TaskBulkActionsExample({ projectId, actorId }: { projectId: string; actorId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── 匯出函式 ───────────────────────────────────────────────────────

  async function handleExport() {
    try {
      const result = await exportTasksToExcelAction(projectId)

      if (!result.success || !result.data) {
        alert(`匯出失敗: ${result.error}`)
        return
      }

      // 將 Base64 轉換為 Blob 並下載
      const binaryString = atob(result.data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      // 建立下載鏈結
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      alert('任務已成功匯出')
    } catch (error) {
      console.error('匯出錯誤:', error)
      alert('匯出過程中發生錯誤')
    }
  }

  // ─── 匯入函式 ───────────────────────────────────────────────────────

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)

      const result = await importTasksFromExcelAction(projectId, formData, actorId)

      if (result.success) {
        alert(`✅ 成功匯入 ${result.count} 個任務`)

        // 顯示詳細資訊（如有錯誤）
        if (result.details?.errors && result.details.errors.length > 0) {
          console.warn('匯入過程中的警告:')
          result.details.errors.forEach((err) => {
            console.warn(`- 行 ${err.row}: ${err.message}`)
          })
        }

        // 重新整理頁面或更新狀態
        window.location.reload()
      } else {
        const errorMsg = result.error || '未知錯誤'
        const details = result.details?.errors?.map((e) => `行 ${e.row}: ${e.message}`).join('\n')

        alert(`❌ 匯入失敗\n\n${errorMsg}\n\n詳細資訊:\n${details || '無'}`)
      }
    } catch (error) {
      console.error('匯入錯誤:', error)
      alert('匯入過程中發生錯誤')
    } finally {
      // 重置檔案輸入
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {/* 匯出按鈕 */}
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          📥 匯出任務 (Excel)
        </button>

        {/* 匯入按鈕 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          📤 匯入任務 (Excel)
        </button>
      </div>

      {/* 隱藏的檔案輸入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImport}
        style={{ display: 'none' }}
      />

      {/* 使用說明 */}
      <div className="mt-6 p-4 bg-gray-100 rounded text-sm">
        <h4 className="font-bold mb-2">使用說明</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>匯出:</strong> 將目前專案的所有任務匯出為 Excel 檔案
          </li>
          <li>
            <strong>匯入:</strong> 從 Excel 檔案批量建立新任務
          </li>
          <li>
            <strong>必填欄位:</strong> 任務代碼、標題、規劃階段、綁定文件代碼
          </li>
          <li>
            <strong>日期格式:</strong> YYYY-MM-DD (例: 2026-03-31)
          </li>
          <li>
            <strong>多值欄位:</strong> 使用逗號分隔多個值 (例: "DOC-001, DOC-002")
          </li>
        </ul>
      </div>
    </div>
  )
}

// ─── Excel 匯入模板範例 ────────────────────────────────────────────────

export const IMPORT_TEMPLATE_EXAMPLE = `
任務代碼	標題	描述	規劃階段	負責人信箱	預計開始日	預計完成日	綁定文件代碼	前置任務代碼
TASK-001	需求分析	分析客戶需求	DesignInput	rd@company.com	2026-04-01	2026-04-15	DOC-001, DOC-002
TASK-002	初步設計	基於需求進行設計	DesignOutput	rd@company.com	2026-04-16	2026-05-01	DOC-003	TASK-001
TASK-003	設計評審	進行內部評審	DesignOutput	qa@company.com	2026-05-02	2026-05-05	DOC-004	TASK-002
TASK-004	驗證測試	執行驗證測試	Verification	qa@company.com	2026-05-06	2026-05-20	DOC-005, DOC-006	TASK-003
`

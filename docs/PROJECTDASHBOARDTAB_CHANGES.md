# ProjectDashboardTab 修改文件

## 概述

已成功修改 `src/components/project/ProjectDashboardTab.tsx`，集成 Excel 匯入/匯出功能和行內快增功能。

## 修改內容

### 1. 匯入項目

```typescript
import { useRef } from 'react'
import {
  exportTasksToExcelAction,
  importTasksFromExcelAction
} from '@/actions/task-bulk-actions'
```

### 2. 新增 State

```typescript
// 隱藏文件輸入的 ref
const fileInputRef = useRef<HTMLInputElement>(null)

// 行內快增相關 state
const [inlineInputValue, setInlineInputValue] = useState('')
const [inlineError, setInlineError] = useState<string | null>(null)
```

### 3. 新增事件處理器

#### `handleExport()`
**功能**: 匯出所有任務為 Excel 檔案

```typescript
const handleExport = async () => {
  try {
    const result = await exportTasksToExcelAction(project.id)
    if (!result.success || !result.data) {
      alert(`匯出失敗: ${result.error}`)
      return
    }

    // 轉換 Base64 為 Blob 並觸發下載
    const binaryString = atob(result.data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // 建立下載連結
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tasks-${project.code}-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  } catch (error) {
    console.error('匯出錯誤:', error)
    alert('匯出過程中發生錯誤')
  }
}
```

#### `handleImportClick()` & `handleImportChange()`
**功能**: 匯入 Excel 檔案並建立任務

```typescript
const handleImportClick = () => {
  fileInputRef.current?.click()
}

const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const formData = new FormData()
    formData.append('file', file)

    // 獲取當前操作者
    const currentUser = lookupUsers[0]
    if (!currentUser) {
      alert('無法確定當前操作者，請稍後再試')
      return
    }

    const result = await importTasksFromExcelAction(
      project.id,
      formData,
      currentUser.id
    )

    if (result.success) {
      alert(`✅ 成功匯入 ${result.count} 個任務`)
      router.refresh()
    } else {
      // 顯示前 5 個錯誤
      const details = result.details?.errors
        ?.slice(0, 5)
        .map((e) => `行 ${e.row}: ${e.message}`)
        .join('\n')

      alert(
        `❌ 匯入失敗\n\n${result.error}\n\n` +
        `${details ? `詳細:\n${details}` : ''}`
      )
    }
  } catch (error) {
    console.error('匯入錯誤:', error)
    alert('匯入過程中發生錯誤')
  } finally {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
}
```

#### `handleInlineSubmit()`
**功能**: 行內快速建立任務

```typescript
const handleInlineSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== 'Enter') return
  e.preventDefault()

  const input = inlineInputValue.trim()
  if (!input) return

  setInlineError(null)

  // 智能解析: [CODE] Title
  const match = input.match(/^\[([^\]]+)\]\s+(.+)$/)
  if (!match) {
    setInlineError('格式錯誤。請使用: [代碼] 任務標題 (例: [DI-001] 撰寫架構文件)')
    return
  }

  const code = match[1].trim()
  const title = match[2].trim()

  if (!code || !title) {
    setInlineError('代碼和標題不能為空')
    return
  }

  // 智能綁定：尋找當前階段的可用文件
  const autoDeliverable = project.deliverables.find(
    (d) => d.phase === project.currentPhase && d.status !== 'Locked'
  )

  if (!autoDeliverable) {
    setInlineError('當前階段無可綁定的文件空殼，請先建立文件')
    return
  }

  try {
    const currentUser = lookupUsers[0]
    if (!currentUser) {
      setInlineError('無法確定當前操作者')
      return
    }

    const res = await createTaskAction({
      projectId: project.id,
      code,
      title,
      plannedPhase: project.currentPhase,
      deliverableIds: [autoDeliverable.id],
      createdById: currentUser.id,
    })

    if (res.success) {
      setInlineInputValue('')
      setInlineError(null)
      router.refresh()
    } else {
      setInlineError(`建立失敗: ${res.error}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setInlineError(`建立異常: ${message}`)
  }
}
```

### 4. UI 變更

#### 匯出/匯入按鈕（Action Buttons Row）

位置：開發任務看板下方的按鈕列

```typescript
<div className="mb-5 flex flex-wrap items-center gap-3">
  {/* 原有按鈕：建立任務、新增文件空殼 */}

  {/* Spacer */}
  <div className="flex-1" />

  {/* 匯出按鈕 */}
  <button
    type="button"
    onClick={handleExport}
    className="inline-flex items-center gap-2 rounded-xl border border-blue-200
               bg-blue-50 px-4 py-2.5 text-[14px] font-bold text-blue-700
               shadow-sm transition-all hover:border-blue-300 hover:bg-blue-100
               focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
    title="匯出所有任務為 Excel 檔案"
  >
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    ⬇️ 匯出 Excel
  </button>

  {/* 匯入按鈕 */}
  <button
    type="button"
    onClick={handleImportClick}
    className="inline-flex items-center gap-2 rounded-xl border border-green-200
               bg-green-50 px-4 py-2.5 text-[14px] font-bold text-green-700
               shadow-sm transition-all hover:border-green-300 hover:bg-green-100
               focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2"
    title="從 Excel 匯入任務"
  >
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l4-4m-4 4h12" />
    </svg>
    ⬆️ 匯入 Excel
  </button>
</div>

{/* 隱藏的檔案輸入 */}
<input
  ref={fileInputRef}
  type="file"
  accept=".xlsx,.xls"
  onChange={handleImportChange}
  style={{ display: 'none' }}
/>
```

#### 行內快增輸入列（WBS 表格最下方）

位置：原 `</tbody>` 前

```typescript
{/* Inline Quick Add Row */}
<tr className="border-t-2 border-slate-300 bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
  <td colSpan={4} className="px-3 py-3">
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="輸入 [代碼] 任務標題 後按 Enter，例如：[DI-005] 撰寫架構文件"
        value={inlineInputValue}
        onChange={(e) => setInlineInputValue(e.target.value)}
        onKeyDown={handleInlineSubmit}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2
                   text-[13px] font-medium text-slate-700 placeholder-slate-400
                   focus:border-blue-500 focus:outline-none focus:ring-2
                   focus:ring-blue-500/20"
      />
      {inlineError && (
        <div className="text-[11px] font-bold text-red-600 flex items-center gap-1.5">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
                  d="M18.101 12.93a1 1 0 00-1.414-1.414L11 14.586V3a1 1 0 10-2 0v11.586l-5.687-5.687a1 1 0 00-1.414 1.414l8 8a1 1 0 001.414 0l8-8z"
                  clipRule="evenodd" />
          </svg>
          {inlineError}
        </div>
      )}
    </div>
  </td>
</tr>
```

### 5. 介面型別更新

```typescript
interface Deliverable {
  id: string
  code: string
  title: string
  status: string
  phase?: ProjectPhase          // ← 新增
  isRequired?: boolean
  targetDate?: Date | string | null
  fileRevisions?: { id: string }[]
}
```

## 匯入資料的屬性頁(Props)要求

確保父組件傳入的 `project` 物件包含:

```typescript
project: {
  id: string
  code: string
  name: string
  currentPhase: ProjectPhase        // ← 用於智能綁定
  deliverables: {
    id: string
    code: string
    title: string
    status: string
    phase?: ProjectPhase            // ← 必須有 phase
    // ... other fields
  }[]
  tasks: Task[]
  // ... other fields
}
```

## 使用者體驗流程

### 匯出流程
1. 使用者點擊「⬇️ 匯出 Excel」
2. 系統呼叫 `exportTasksToExcelAction()`
3. 自動下載 `tasks-{projectCode}-{date}.xlsx`
4. 可透過 Excel 應用開啟檢視或編輯

### 匯入流程
1. 使用者點擊「⬆️ 匯入 Excel」
2. 開啟檔案選擇對話框
3. 選擇已編輯的 Excel 檔案
4. 系統驗證並建立任務
5. 顯示成功/失敗的訊息
6. 成功時自動重新載入頁面

### 快速新增流程
1. 在 WBS 表格最下方輸入框輸入: `[DI-005] 撰寫架構文件`
2. 按 Enter 鍵
3. 系統自動:
   - 解析代碼 (DI-005) 和標題 (撰寫架構文件)
   - 找尋當前階段的可用文件
   - 建立任務並自動綁定文件
4. 成功後清空輸入框並刷新頁面

## 已知限制與改進建議

### 1. 當前使用者偵測
**現況**: 使用 `lookupUsers[0]` 獲取使用者
```typescript
const currentUser = lookupUsers[0]
```

**建議改進**:
- 使用 `useSession()` 或類似的認證上下文
- 從 URL 參數或 cookie 中獲取當前使用者
- 從 API 端點獲取當前已登入使用者

### 2. 錯誤訊息限制
**現況**: 匯入失敗時只顯示前 5 個錯誤
**建議**: 提供錯誤詳情頁面或可下載的錯誤報告

### 3. 進度指示
**建議**: 對於大量匯入，添加進度指示器或加載動畫

## 除錯提示

### 匯出不工作
- 檢查 `exportTasksToExcelAction()` 返回的 `data` 是否為 null
- 檢查瀏覽器控制台是否有錯誤訊息
- 確認 Base64 解碼正確: `atob()` 應該返回有效的二進位資料

### 匯入不工作
1. 確認 Excel 檔案格式正確
2. 檢查欄位標題與系統期望相符
3. 查看 `importTasksFromExcelAction()` 返回的詳細錯誤訊息
4. 確認用戶信箱、文件代碼等引用都正確

### 快速新增提示不符合預期
- 確認格式: 必須是 `[CODE] Title` 格式
- 檢查 Regex: `/^\[([^\]]+)\]\s+(.+)$/`
- 確認當前階段有可用的文件（狀態不為 Locked）

## 完整範例

```typescript
// 完整的使用流程示例

// 1. 匯出
await handleExport()  // 觸發下載

// 2. 編輯 Excel 檔案
// 使用 Excel/Google Sheets 編輯 tasks-PRJ-2026-03-31.xlsx

// 3. 匯入
// 選擇編輯後的檔案，系統自動建立任務

// 4. 快速新增
// 在快速輸入框輸入: [T-101] 進行使用者測試
// 按 Enter，任務立即建立
```

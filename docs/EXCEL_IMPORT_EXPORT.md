# Excel 任務匯入匯出功能文件

## 概述

本功能提供醫療器材專案任務的雙向 Excel 支持，允許團隊以批量方式建立任務，並匯出任務進行外部協作。

## 安裝

### 1. 安裝依賴

```bash
npm install xlsx --legacy-peer-deps
```

> ⚠️ **注意**: 由於 gantt-task-react 對 React 版本的限制，需要使用 `--legacy-peer-deps` 標誌。

### 2. 驗證安裝

```bash
npm list xlsx
```

## API 參考

### `exportTasksToExcelAction(projectId: string)`

從專案匯出所有任務為 Excel 文件（Base64 編碼）。

**參數:**
- `projectId` (string): 專案 ID

**返回:**
```typescript
{
  success: boolean
  data?: string        // Base64 編碼的 Excel Buffer
  error?: string       // 失敗時的錯誤訊息
}
```

**用途:**
- 導出任務清單進行離線審查
- 與外部系統進行資料交換
- 備份和歸檔

**範例:**

```typescript
const result = await exportTasksToExcelAction(projectId)

if (result.success && result.data) {
  // 下載 Base64 資料
  const binary = atob(result.data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  // 建立下載...
}
```

### `importTasksFromExcelAction(projectId: string, formData: FormData, actorId: string)`

從上傳的 Excel 文件批量建立任務。

**參數:**
- `projectId` (string): 目標專案 ID
- `formData` (FormData): 包含 Excel 文件的 FormData (`formData.get('file')`)
- `actorId` (string): 執行匯入操作的用戶 ID

**返回:**
```typescript
{
  success: boolean
  count?: number       // 成功建立的任務數
  error?: string       // 失敗時的錯誤訊息
  details?: {
    created: number
    failed: number
    errors: Array<{ row: number; message: string }>
  }
}
```

**驗證流程:**

1. **必填欄位檢查:**
   - ✅ 任務代碼 (code)
   - ✅ 標題 (title)
   - ✅ 規劃階段 (plannedPhase)
   - ✅ 綁定文件代碼 (deliverableCodes) - **必須、不能為空**

2. **引用驗證:**
   - ✅ 負責人信箱必須存在於 User 表
   - ✅ 綁定文件代碼必須存在於同專案的 DeliverablePlaceholder
   - ✅ 前置任務代碼可以是現有任務或同批匯入的新任務

3. **資料驗證:**
   - ✅ 任務代碼在專案內唯一
   - ✅ 規劃階段為有效的 ProjectPhase 列舉值
   - ✅ 日期格式為 YYYY-MM-DD

**範例:**

```typescript
const formData = new FormData()
formData.append('file', excelFile)

const result = await importTasksFromExcelAction(projectId, formData, actorId)

if (result.success) {
  console.log(`✅ 成功建立 ${result.count} 個任務`)

  if (result.details?.errors.length) {
    result.details.errors.forEach(err => {
      console.warn(`行 ${err.row}: ${err.message}`)
    })
  }
} else {
  console.error(`❌ 匯入失敗: ${result.error}`)
}
```

## Excel 文件格式

### 列標題（繁體中文）

| 欄位名 | 類型 | 必填 | 說明 |
|------|------|------|------|
| 任務代碼 | Text | ✅ | 專案內唯一識別符，例如 "TASK-001" |
| 標題 | Text | ✅ | 任務簡短標題 |
| 描述 | Text | ❌ | 任務詳細描述 |
| 規劃階段 | Enum | ✅ | 有效值: Concept, Planning, DesignInput, DesignOutput, Verification, Validation, DesignTransfer, PostMarket |
| 負責人信箱 | Email | ❌ | 必須存在於系統中的用戶信箱 |
| 預計開始日 | Date | ❌ | 格式: YYYY-MM-DD，例如 2026-04-01 |
| 預計完成日 | Date | ❌ | 格式: YYYY-MM-DD，例如 2026-04-15 |
| 綁定文件代碼 | Text | ✅ | 逗號分隔的文件代碼列表，例如 "DOC-001, DOC-002" |
| 前置任務代碼 | Text | ❌ | 逗號分隔的任務代碼列表，例如 "TASK-001, TASK-002" |

### 範例資料

```
任務代碼	標題	描述	規劃階段	負責人信箱	預計開始日	預計完成日	綁定文件代碼	前置任務代碼
TASK-001	需求收集	收集客戶需求	DesignInput	rd@company.com	2026-04-01	2026-04-15	REQ-001, REQ-002
TASK-002	初步設計	基於需求提出設計方案	DesignOutput	rd@company.com	2026-04-16	2026-05-01	DESIGN-001	TASK-001
TASK-003	設計評審	進行內部設計評審	DesignOutput	qa@company.com	2026-05-02	2026-05-05	REVIEW-001	TASK-002
TASK-004	驗證測試	執行產品驗證	Verification	qa@company.com	2026-05-06	2026-05-20	TEST-001, TEST-002	TASK-003
```

## 重要特性

### 1. 合規性要求

根據 ISO 13485 和 FDA Design Controls，**每個任務必須綁定至少一個文件佔位符 (DeliverablePlaceholder)**。

- ✅ 系統自動建立 TaskDeliverable 關聯
- ✅ 匯入時檢查文件綁定
- ✅ 不允許建立孤立的任務

### 2. 跨批次任務依賴

任務可以在同一批次內相互參考：

```
前置任務代碼	說明
(空值)	此任務沒有依賴
TASK-001	此任務依賴現有任務
TASK-002, TASK-003	此任務依賴多個任務（新建或現有）
```

系統會自動解析前置任務參考，無論它們是現有任務還是同批匯入的新任務。

### 3. 審計追蹤

所有匯入的任務都會自動記錄審計日誌：

- **Action**: `task.create`
- **Source**: `bulk_import`
- **Actor**: 執行匯入的用戶
- **Detail**: 包含任務代碼、所屬文件等資訊

### 4. 交易安全

所有任務在單一資料庫交易中建立，確保：
- ✅ 要嘛全部成功，要嘛全部失敗
- ✅ 無部分建立狀態
- ✅ 資料一致性

## 錯誤處理

### 常見錯誤

| 錯誤訊息 | 原因 | 解決方案 |
|-------|------|-------|
| `綁定文件代碼必填（合規要求）` | 未提供文件代碼 | 在「綁定文件代碼」欄填入至少一個文件代碼 |
| `找不到文件代碼 'XXX'` | 文件代碼不存在 | 確認文件代碼在系統中存在且屬於同一專案 |
| `任務代碼已存在於專案中` | 任務代碼重複 | 修改任務代碼為唯一值 |
| `找不到用戶信箱 'xxx@company.com'` | 用戶不存在 | 確認用戶已在系統中註冊 |
| `無效的規劃階段 'XXX'` | 階段值不正確 | 使用有效的階段值 (見上表) |
| `無效的日期格式 (需要 YYYY-MM-DD)` | 日期格式不符 | 使用 YYYY-MM-DD 格式 |

### 錯誤回應結構

匯入成功但有部分行失敗時：

```typescript
{
  success: true,
  count: 3,
  details: {
    created: 3,
    failed: 2,
    errors: [
      { row: 5, message: "TASK-004: 找不到文件代碼 'INVALID-CODE'" },
      { row: 6, message: "TASK-005: 任務代碼已存在於專案中" }
    ]
  }
}
```

## 故障排除

### Q: 匯出後檔案無法開啟

**A:** 確認客戶端正確解碼 Base64 數據。參考 `task-bulk-actions-example.tsx` 中的下載實作。

### Q: 匯入時提示「找不到文件代碼」

**A:**
1. 確認文件代碼在「設定 → 交付物」中存在
2. 檢查文件代碼是否屬於同一專案
3. 確認欄值中沒有多餘空格

### Q: 前置任務參考無法解析

**A:**
1. 確認任務代碼正確拼寫
2. 若參考新建立任務，確保該任務在同一 Excel 文件中且位於前面
3. 多個參考使用逗號分隔：`TASK-001, TASK-002`

### Q: 交易失敗，部分任務已建立

**A:** 不會發生。系統使用資料庫交易確保原子性。若交易失敗，所有更改都會回滾。

## 性能考量

- **大批次建立**: 系統使用單一交易進行批次操作，通常 100+ 任務無性能問題
- **記憶體**: 整個 Excel 文件在建立之前會被讀入記憶體
- **驗證**: 所有驗證在交易之前進行，以减少交易持續時間

## 限制

1. **Excel 格式**: 僅支持 .xlsx 和 .xls 文件
2. **工作表**: 只讀取第一個工作表
3. **最大行數**: 沒有硬限制，但取決於系統資源
4. **字符編碼**: 自動偵測，推薦使用 UTF-8
5. **公式和宏**: 將被忽略，僅值被讀取

## 相關功能

- 任務建立: `src/lib/task-service.ts` - `createTask()`
- 審計紀錄: `src/lib/audit-log-service.ts` - `recordAudit()`
- Task 模型: `prisma/schema.prisma` - Task 關聯

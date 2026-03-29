import type { CSSProperties } from 'react'
import { DeliverableStatus, ProjectPhase, Role } from '@prisma/client'
import { redirect } from 'next/navigation'

import {
  advancePhaseAction,
} from '@/actions/phase-actions'
import {
  createTaskAction,
  startTaskAction,
  completeTaskAction,
} from '@/actions/task-actions'
import {
  createDeliverableAction,
  updateDeliverableStatusAction,
} from '@/actions/deliverable-actions'
import {
  ActionLink,
  AppShell,
  EmptyPanel,
  MetricCard,
  SectionCard,
  StatusPill,
} from '@/components/app-shell'
import { getProjectDetail, getWorkspaceLookupData } from '@/lib/frontend-data'
import {
  formatAdvanceOutcome,
  formatChangeRequestStatus,
  formatDateTimeZh,
  formatDeliverableStatus,
  formatPendingItemStatus,
  formatProjectPhase,
  formatRole,
  formatTaskStatus,
} from '@/lib/ui-labels'

type Params = Promise<{ projectId: string }>
type SearchParams = Promise<{ notice?: string; error?: string }>

function buildUrl(projectId: string, params: { notice?: string; error?: string }) {
  const search = new URLSearchParams()
  if (params.notice) search.set('notice', params.notice)
  if (params.error) search.set('error', params.error)
  const query = search.toString()
  return query ? `/projects/${projectId}?${query}` : `/projects/${projectId}`
}

function formatFileSize(value: number | null) {
  if (!value || value <= 0) {
    return '大小未知'
  }

  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { projectId } = await params
  const [urlState, data, lookup] = await Promise.all([
    searchParams,
    getProjectDetail(projectId),
    getWorkspaceLookupData(),
  ])

  if (!data) {
    return (
      <AppShell
        eyebrow="專案詳情"
        title="找不到此專案"
        description="系統中不存在你要查看的專案紀錄。"
        actions={<ActionLink href="/projects" label="返回專案總覽" />}
      >
        <EmptyPanel
          title="專案不存在"
          body="請重新確認專案 ID，或回到專案總覽重新選擇。"
        />
      </AppShell>
    )
  }

  const { project, gate } = data

  async function createTaskForm(formData: FormData) {
    'use server'

    const result = await createTaskAction({
      projectId,
      code: String(formData.get('code') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      assigneeId: String(formData.get('assigneeId') ?? '') || undefined,
      createdById: String(formData.get('createdById') ?? '') || undefined,
      plannedPhase: String(formData.get('plannedPhase') ?? ProjectPhase.Planning) as ProjectPhase,
      deliverableIds: formData.getAll('deliverableIds').map(String),
    })

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `已建立任務 ${result.data.code}` }))
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  async function startTaskForm(formData: FormData) {
    'use server'

    const taskId = String(formData.get('taskId') ?? '')
    const result = await startTaskAction(taskId)

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `任務已開始執行` }))
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  async function completeTaskForm(formData: FormData) {
    'use server'

    const taskId = String(formData.get('taskId') ?? '')
    const result = await completeTaskAction(taskId)

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `任務 ${result.data.id.slice(0, 8)} 已完成` }))
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  async function advanceProject(formData: FormData) {
    'use server'

    const forceOverride = formData.get('forceOverride') === 'true'
    const triggeredById = String(formData.get('triggeredById') ?? '') || undefined
    const result = await advancePhaseAction({
      projectId,
      forceOverride,
      triggeredById: forceOverride ? undefined : triggeredById,
      overriddenById: forceOverride
        ? String(formData.get('overriddenById') ?? '') || undefined
        : undefined,
      rationale: forceOverride
        ? String(formData.get('rationale') ?? '') || undefined
        : undefined,
    })

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `階段結果：${formatAdvanceOutcome(result.outcome)}` }))
    }

    redirect(buildUrl(projectId, { error: result.message }))
  }

  async function createDeliverableForm(formData: FormData) {
    'use server'

    const result = await createDeliverableAction({
      projectId,
      code: String(formData.get('code') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      phase: String(formData.get('phase') ?? project.currentPhase) as ProjectPhase,
      ownerId: String(formData.get('ownerId') ?? '') || undefined,
      isRequired: formData.get('isRequired') === 'true',
    })

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `已建立文件 ${result.data.code}` }))
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  async function updateDeliverableStatusForm(formData: FormData) {
    'use server'

    const result = await updateDeliverableStatusAction({
      deliverableId: String(formData.get('deliverableId') ?? ''),
      status: String(formData.get('status') ?? DeliverableStatus.Draft) as DeliverableStatus,
      actedById: String(formData.get('actedById') ?? '') || undefined,
      comment: String(formData.get('comment') ?? '') || undefined,
    })

    if (result.success) {
      redirect(
        buildUrl(projectId, {
          notice: `文件 ${result.data.code} 已更新為 ${formatDeliverableStatus(result.data.status)}`,
        }),
      )
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  const doneTasks = project.tasks.filter((task) => task.status === 'Done').length
  const atRiskTasks = project.tasks.filter(
    (task) => task.plannedPhase !== project.currentPhase && task.status !== 'Done',
  ).length
  const releasedDeliverables = project.deliverables.filter(
    (deliverable) => deliverable.status === 'Released',
  ).length
  const openPendingItems = project.pendingItems.filter((item) => item.status === 'Open').length
  const rdUsers = lookup.users.filter((user) => user.role === Role.RD)
  const qaUsers = lookup.users.filter((user) => user.role === Role.QA || user.role === Role.ADMIN)

  return (
    <AppShell
      eyebrow={project.code}
      title={project.name}
      description={
        project.description ??
        '這是專案主工作台，可直接操作階段推進、任務、文件、遺留項與變更單。'
      }
      actions={<ActionLink href="/projects" label="返回專案總覽" tone="secondary" />}
    >
      {(urlState.notice || urlState.error) && (
        <div
          style={{
            marginBottom: 18,
            borderRadius: 20,
            padding: '14px 16px',
            background: urlState.notice
              ? 'rgba(72, 131, 82, 0.12)'
              : 'rgba(149, 58, 52, 0.12)',
            color: urlState.notice ? '#2d6637' : '#8a2f2c',
            border: `1px solid ${
              urlState.notice ? 'rgba(72, 131, 82, 0.18)' : 'rgba(149, 58, 52, 0.18)'
            }`,
          }}
        >
          {urlState.notice ?? urlState.error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <MetricCard label="當前階段" value={formatProjectPhase(project.currentPhase)} />
        <MetricCard
          label="已完成任務"
          value={`${doneTasks}/${project.tasks.length}`}
          accent="var(--app-accent)"
        />
        <MetricCard
          label="At-Risk 任務"
          value={String(atRiskTasks)}
          hint="超前或落後專案當前階段的進行中任務"
          accent={atRiskTasks > 0 ? 'var(--app-danger)' : 'var(--app-success)'}
        />
        <MetricCard
          label="已釋出文件"
          value={`${releasedDeliverables}/${project.deliverables.length}`}
          accent="var(--app-success)"
        />
        <MetricCard
          label="未結遺留項"
          value={String(openPendingItems)}
          accent={openPendingItems > 0 ? 'var(--app-danger)' : 'var(--app-success)'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 0.95fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <SectionCard
          title="階段關卡控制"
          subtitle="先確認文件是否齊全，再決定是正常推進，或以條件式放行進入下一階段。"
        >
          {gate?.canAdvance ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <StatusPill label={`下一階段：${formatProjectPhase(gate.nextPhase)}`} tone="good" />
              </div>
              <form action={advanceProject} style={{ display: 'grid', gap: 10 }}>
                <select name="triggeredById" defaultValue="" style={inputStyle}>
                  <option value="">選擇推進操作者</option>
                  {lookup.users
                    .filter((user) => user.role === Role.PM || user.role === Role.ADMIN)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} · {formatRole(user.role)}
                      </option>
                    ))}
                </select>
                <button type="submit" style={buttonStyle}>
                  推進階段
                </button>
              </form>
            </>
          ) : gate ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <StatusPill
                  label={gate.isHardGate ? '硬關卡' : '軟關卡警示'}
                  tone={gate.isHardGate ? 'critical' : 'warn'}
                />
                <StatusPill label={`問題 ${gate.issues.length} 項`} tone="neutral" />
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                {gate.issues.map((issue) => (
                  <div
                    key={`${issue.deliverableId}-${issue.reason}`}
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      background: 'rgba(255,255,255,0.52)',
                    }}
                  >
                    <strong>{issue.deliverableCode}</strong> · {issue.deliverableTitle}
                    <div style={{ color: '#6b563f', marginTop: 6 }}>{issue.reason}</div>
                  </div>
                ))}
              </div>
              {!gate.isHardGate ? (
                <form action={advanceProject} style={{ display: 'grid', gap: 10 }}>
                  <input type="hidden" name="forceOverride" value="true" />
                  <select name="overriddenById" defaultValue="" style={inputStyle}>
                    <option value="">選擇放行核准者</option>
                    {lookup.users
                      .filter((user) => user.role === Role.PM || user.role === Role.ADMIN)
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} · {formatRole(user.role)}
                        </option>
                      ))}
                  </select>
                  <textarea
                    name="rationale"
                    placeholder="條件式放行原因"
                    style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }}
                  />
                  <button type="submit" style={buttonStyle}>
                    條件式放行
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <EmptyPanel
              title="關卡暫時無法評估"
              body="系統目前無法判斷此專案是否可推進到下一階段。"
            />
          )}
        </SectionCard>

        <SectionCard
          title="建立任務"
          subtitle="開發任務與專案當前階段刻意脫鉤，讓研發可提前規劃未來階段工作，但系統仍會把風險顯示出來。"
          tone="dark"
        >
          <form action={createTaskForm} style={{ display: 'grid', gap: 10 }}>
            <input name="code" placeholder="任務代碼" style={inputStyleDark} />
            <input name="title" placeholder="任務名稱" style={inputStyleDark} />
            <textarea
              name="description"
              placeholder="任務描述"
              style={{ ...inputStyleDark, minHeight: 88, resize: 'vertical' }}
            />
            <select name="plannedPhase" defaultValue={project.currentPhase} style={inputStyleDark}>
              {Object.values(ProjectPhase).map((phase) => (
                <option key={phase} value={phase}>
                  {formatProjectPhase(phase)}
                </option>
              ))}
            </select>
            <select name="assigneeId" defaultValue="" style={inputStyleDark}>
              <option value="">稍後再指派 RD</option>
              {rdUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select name="createdById" defaultValue="" style={inputStyleDark}>
              <option value="">由系統 / 目前使用者建立</option>
              {lookup.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {formatRole(user.role)}
                </option>
              ))}
            </select>
            <select
              name="deliverableIds"
              multiple
              defaultValue={project.deliverables.slice(0, 2).map((deliverable) => deliverable.id)}
              style={{ ...inputStyleDark, minHeight: 150 }}
            >
              {project.deliverables.map((deliverable) => (
                <option key={deliverable.id} value={deliverable.id}>
                  {deliverable.code} · {deliverable.title}
                </option>
              ))}
            </select>
            <button type="submit" style={buttonStyleLight}>
              建立可追溯任務
            </button>
          </form>
        </SectionCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <SectionCard
          title="開發任務"
          subtitle="任務允許先於專案當前階段啟動，系統只提示風險，不會把 RD 的實際工作直接鎖死。"
        >
          {project.tasks.length === 0 ? (
            <EmptyPanel title="尚無任務" body="可從右側表單建立第一筆可追溯的 RD 任務。" />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {project.tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: 'rgba(255,255,255,0.54)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: '#896945' }}>{task.code}</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{task.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <StatusPill
                        label={formatTaskStatus(task.status)}
                        tone={
                          task.status === 'Done'
                            ? 'good'
                            : task.status === 'InProgress'
                              ? 'warn'
                              : 'neutral'
                        }
                      />
                      <StatusPill
                        label={`預計階段 ${formatProjectPhase(task.plannedPhase)}`}
                        tone={task.plannedPhase !== project.currentPhase ? 'warn' : 'neutral'}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10, color: '#65513a', lineHeight: 1.6 }}>
                    {task.description ?? '尚未填寫任務描述。'}
                  </div>
                  <div style={{ marginTop: 10, color: '#5b452c' }}>
                    綁定文件：
                    {task.deliverableLinks.map((link) => link.deliverable.code).join(', ')}
                  </div>
                  <div style={{ marginTop: 8, color: '#5b452c' }}>
                    指派給：{task.assignee?.name ?? '未指派'}
                  </div>
                  {task.status === 'Todo' ? (
                    <form action={startTaskForm} style={{ marginTop: 12 }}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button type="submit" style={buttonStyle}>
                        開始執行
                      </button>
                    </form>
                  ) : task.status === 'InProgress' ? (
                    <form action={completeTaskForm} style={{ marginTop: 12 }}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button type="submit" style={buttonStyle}>
                        標記完成
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="建立文件空殼"
          subtitle="新增下一份法規文件、指派 QA 負責人，並定義它屬於哪一個階段關卡。"
          tone="dark"
        >
          <form action={createDeliverableForm} style={{ display: 'grid', gap: 10 }}>
            <input name="code" placeholder="文件代碼" style={inputStyleDark} />
            <input name="title" placeholder="文件名稱" style={inputStyleDark} />
            <textarea
              name="description"
              placeholder="文件說明"
              style={{ ...inputStyleDark, minHeight: 88, resize: 'vertical' }}
            />
            <select name="phase" defaultValue={project.currentPhase} style={inputStyleDark}>
              {Object.values(ProjectPhase).map((phase) => (
                <option key={phase} value={phase}>
                  {formatProjectPhase(phase)}
                </option>
              ))}
            </select>
            <select name="ownerId" defaultValue="" style={inputStyleDark}>
              <option value="">稍後再指定 QA 負責人</option>
              {qaUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {formatRole(user.role)}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#fff7ec' }}>
              <input type="checkbox" name="isRequired" value="true" defaultChecked />
              納入關卡審查
            </label>
            <button type="submit" style={buttonStyleLight}>
              建立文件空殼
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard
        title="合規文件"
        subtitle="集中管理檔案版次、QA 釋出狀態，以及因條件式放行而留下的風險債務。"
      >
        {project.deliverables.length === 0 ? (
          <EmptyPanel
            title="尚無文件空殼"
            body="先從上方建立第一份文件，之後就能綁定任務與版次。"
          />
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {project.deliverables.map((deliverable) => (
              <div
                key={deliverable.id}
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: 'rgba(255,255,255,0.56)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: '#896945' }}>{deliverable.code}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{deliverable.title}</div>
                    <div style={{ marginTop: 8, color: '#5b452c' }}>
                      負責人：{deliverable.owner?.name ?? '未指派'} · 版次：
                      {deliverable.fileRevisions.length} · 關聯遺留項：{deliverable.pendingItems.length}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusPill
                      label={formatDeliverableStatus(deliverable.status)}
                      tone={
                        deliverable.status === 'Released'
                          ? 'good'
                          : deliverable.status === 'Locked'
                            ? 'critical'
                            : deliverable.status === 'InReview'
                              ? 'neutral'
                              : 'warn'
                      }
                    />
                    <StatusPill label={formatProjectPhase(deliverable.phase)} tone="neutral" />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={fieldLabelStyle}>已登記版次</div>
                  {deliverable.fileRevisions.length === 0 ? (
                    <div
                      style={{
                        marginTop: 8,
                        borderRadius: 18,
                        padding: 14,
                        background: 'rgba(255,255,255,0.46)',
                        color: '#6d5942',
                      }}
                    >
                      尚未上傳任何檔案。
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      {deliverable.fileRevisions.map((revision) => (
                        <a
                          key={revision.id}
                          href={`/api/file-revisions/${revision.id}/download`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            borderRadius: 18,
                            padding: '12px 14px',
                            background: 'rgba(255,255,255,0.66)',
                            textDecoration: 'none',
                            color: '#3d2f1d',
                          }}
                        >
                          <span>
                            r{revision.revisionNumber} · {revision.fileName}
                          </span>
                          <span style={{ color: '#6a543b', fontSize: 14 }}>
                            {formatFileSize(revision.fileSizeBytes)} ·{' '}
                            {new Intl.DateTimeFormat('zh-TW', {
                              dateStyle: 'medium',
                            }).format(revision.createdAt)}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 280px',
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  <form
                    action={`/api/projects/${projectId}/deliverables/${deliverable.id}/revisions`}
                    method="POST"
                    encType="multipart/form-data"
                    style={{ display: 'grid', gap: 10 }}
                  >
                    <div style={fieldLabelStyle}>登記檔案版次</div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                      }}
                    >
                      <input name="file" type="file" style={inputStyle} />
                      <input
                        name="revisionNumber"
                        type="number"
                        min="1"
                        placeholder="版次號（可選）"
                        style={inputStyle}
                      />
                      <select name="uploadedById" defaultValue="" style={inputStyle}>
                        <option value="">上傳者</option>
                        {lookup.users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} · {formatRole(user.role)}
                          </option>
                        ))}
                      </select>
                      <select name="changeRequestId" defaultValue="" style={inputStyle}>
                        <option value="">稍後再關聯變更單</option>
                        {project.changeRequests.map((changeRequest) => (
                          <option key={changeRequest.id} value={changeRequest.id}>
                            {changeRequest.code} · {changeRequest.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      name="changeSummary"
                      placeholder="此次版更摘要"
                      style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                    />
                    <button type="submit" style={buttonStyle}>
                      上傳版次
                    </button>
                    <div style={{ color: '#6c573f', lineHeight: 1.5 }}>
                      若文件已鎖定，必須先關聯變更單，才能上傳新的檔案版次。
                    </div>
                  </form>

                  <form action={updateDeliverableStatusForm} style={{ display: 'grid', gap: 10 }}>
                    <input type="hidden" name="deliverableId" value={deliverable.id} />
                    <div style={fieldLabelStyle}>QA 狀態控制</div>
                    {(deliverable.status === DeliverableStatus.Draft ||
                      deliverable.status === DeliverableStatus.InReview) ? (
                      <>
                        <select name="actedById" defaultValue="" style={inputStyle}>
                          <option value="">QA 審查 / 核准者</option>
                          {qaUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} · {formatRole(user.role)}
                            </option>
                          ))}
                        </select>
                        <textarea
                          name="comment"
                          placeholder="審查備註 / 核准說明"
                          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                        />
                      </>
                    ) : null}
                    {deliverable.status === DeliverableStatus.Draft ? (
                      <button
                        type="submit"
                        name="status"
                        value={DeliverableStatus.InReview}
                        style={buttonStyle}
                      >
                        送出審查
                      </button>
                    ) : deliverable.status === DeliverableStatus.InReview ? (
                      <>
                        <button
                          type="submit"
                          name="status"
                          value={DeliverableStatus.Released}
                          style={buttonStyle}
                        >
                          核准釋出
                        </button>
                        <button
                          type="submit"
                          name="status"
                          value={DeliverableStatus.Draft}
                          style={secondaryButtonStyle}
                        >
                          退回草稿
                        </button>
                      </>
                    ) : deliverable.status === DeliverableStatus.Released ? (
                      <div style={{ color: '#6c573f', lineHeight: 1.5 }}>
                        文件已釋出，狀態不可手動變更。如需修改，請透過變更單流程建立新版次。
                      </div>
                    ) : (
                      <div style={{ color: '#6c573f', lineHeight: 1.5 }}>
                        文件已鎖定。如需修改，需建立變更單並經核准後上傳新版次。
                      </div>
                    )}
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="遺留項、稽核軌跡與變更單"
        subtitle="每一次條件式放行都會留下軌跡，直到明確結案；設計移轉後的變更也會持續掛在專案紀錄上。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {project.pendingItems.length === 0 ? (
              <EmptyPanel
                title="沒有遺留項"
                body="此專案目前沒有未結或歷史遺留項。"
              />
            ) : (
              project.pendingItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: 'rgba(255,255,255,0.54)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>{item.title}</strong>
                    <StatusPill
                      label={formatPendingItemStatus(item.status)}
                      tone={item.status === 'Resolved' ? 'good' : 'critical'}
                    />
                  </div>
                  <div style={{ marginTop: 8, color: '#5f4a34' }}>
                    {item.deliverable.code} · {item.deliverable.title}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {project.phaseTransitions.map((transition) => (
              <div
                key={transition.id}
                style={{
                  borderRadius: 20,
                  padding: 16,
                  background: 'rgba(255,255,255,0.54)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <strong>
                    {formatProjectPhase(transition.fromPhase)} →{' '}
                    {formatProjectPhase(transition.toPhase)}
                  </strong>
                  <StatusPill
                    label={transition.wasOverride ? '條件式放行' : '正常推進'}
                    tone={transition.wasOverride ? 'warn' : 'good'}
                  />
                </div>
                <div style={{ marginTop: 8, color: '#5f4a34' }}>
                  觸發者：{transition.triggeredBy?.name ?? '系統'} ·{' '}
                  {formatDateTimeZh(transition.createdAt)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {project.changeRequests.length === 0 ? (
              <EmptyPanel
                title="沒有變更單"
                body="第一張 CR 建立後，設計移轉後的變更控制就會顯示在這裡。"
              />
            ) : (
              project.changeRequests.map((changeRequest) => (
                <div
                  key={changeRequest.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: 'rgba(255,255,255,0.54)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>
                      {changeRequest.code} · {changeRequest.title}
                    </strong>
                    <StatusPill
                      label={formatChangeRequestStatus(changeRequest.status)}
                      tone={
                        changeRequest.status === 'Approved' || changeRequest.status === 'Implemented'
                          ? 'good'
                          : changeRequest.status === 'Rejected'
                            ? 'critical'
                            : 'warn'
                      }
                    />
                  </div>
                  <div style={{ marginTop: 8, color: '#5f4a34' }}>
                    提出者：{changeRequest.requester?.name ?? '未指派'}
                  </div>
                  <div style={{ marginTop: 8, color: '#5f4a34' }}>
                    關聯文件：
                    {changeRequest.deliverableLinks.length > 0
                      ? changeRequest.deliverableLinks
                          .map((link) => link.deliverable.code)
                          .join(', ')
                      : '無'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>
    </AppShell>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(73, 52, 27, 0.18)',
  background: 'rgba(255,255,255,0.76)',
  padding: '14px 16px',
  fontSize: 15,
  color: '#2f2418',
  boxSizing: 'border-box',
}

const inputStyleDark: CSSProperties = {
  ...inputStyle,
  background: 'rgba(255, 244, 228, 0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  color: '#fff7ec',
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#8c6e4f',
}

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#6b4927',
  color: '#fff7ee',
  fontWeight: 700,
}

const buttonStyleLight: CSSProperties = {
  ...buttonStyle,
  background: '#fff4df',
  color: '#442e17',
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: 'rgba(255, 248, 239, 0.88)',
  color: '#4d351c',
}

const criticalButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#8a2f2c',
  color: '#fff5f3',
}

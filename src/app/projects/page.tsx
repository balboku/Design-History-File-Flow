import type { CSSProperties } from 'react'
import { ProjectPhase } from '@prisma/client'
import { redirect } from 'next/navigation'

import { createProjectAction } from '@/actions/project-actions'
import {
  ActionLink,
  AppShell,
  EmptyPanel,
  MetricCard,
  SectionCard,
  StatusPill,
} from '@/components/app-shell'
import { getProjectSummaries, getWorkspaceLookupData } from '@/lib/frontend-data'

type SearchParams = Promise<{ notice?: string; error?: string }>

function buildUrl(params: { notice?: string; error?: string }) {
  const search = new URLSearchParams()

  if (params.notice) search.set('notice', params.notice)
  if (params.error) search.set('error', params.error)

  const query = search.toString()
  return query ? `/projects?${query}` : '/projects'
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [projects, lookup, urlState] = await Promise.all([
    getProjectSummaries(),
    getWorkspaceLookupData(),
    searchParams,
  ])

  async function createProjectForm(formData: FormData) {
    'use server'

    const result = await createProjectAction({
      code: String(formData.get('code') ?? ''),
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      currentPhase: String(formData.get('currentPhase') ?? ProjectPhase.Concept) as ProjectPhase,
      ownerId: String(formData.get('ownerId') ?? '') || undefined,
    })

    if (result.success) {
      redirect(buildUrl({ notice: `Project ${result.data.code} created` }))
    }

    redirect(buildUrl({ error: result.error }))
  }

  const openPendingProjects = projects.filter((project) => project.openPendingItemCount > 0).length
  const portfolioDoneRate = projects.length
    ? `${projects.reduce((sum, project) => sum + project.doneTaskCount, 0)}/${projects.reduce((sum, project) => sum + project.taskCount, 0)}`
    : '0/0'
  const ownerOptions = lookup.users.filter(
    (user) => user.role === 'PM' || user.role === 'ADMIN',
  )

  return (
    <AppShell
      eyebrow="Portfolio View"
      title="Projects"
      description="See every program at once, create a new regulated project record, and keep the portfolio moving without hiding compliance debt."
      actions={<ActionLink href="/change-requests" label="Open Change Requests" />}
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
            border: `1px solid ${urlState.notice ? 'rgba(72, 131, 82, 0.18)' : 'rgba(149, 58, 52, 0.18)'}`,
          }}
        >
          {urlState.notice ?? urlState.error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <MetricCard label="Total Projects" value={String(projects.length)} />
        <MetricCard
          label="Projects With Pending Items"
          value={String(openPendingProjects)}
          accent="#8a2f2c"
        />
        <MetricCard
          label="Portfolio Task Completion"
          value={portfolioDoneRate}
          accent="#8a4e22"
        />
        <MetricCard
          label="Healthy Programs"
          value={String(projects.length - openPendingProjects)}
          accent="#315f3a"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <SectionCard
          title="Program Cards"
          subtitle="Each card shows execution progress, compliance readiness, and risk residue."
        >
          {projects.length === 0 ? (
            <EmptyPanel
              title="No projects yet"
              body="Create your first project from the command panel on the right."
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 18,
              }}
            >
              {projects.map((project) => (
                <a
                  key={project.id}
                  href={`/projects/${project.id}`}
                  style={{
                    textDecoration: 'none',
                    color: '#2f2418',
                    borderRadius: 26,
                    padding: 22,
                    background: 'rgba(255,255,255,0.68)',
                    border: '1px solid rgba(73, 52, 27, 0.12)',
                    boxShadow: '0 18px 40px rgba(57, 37, 16, 0.08)',
                  }}
                >
                  <div style={{ color: '#896945', fontSize: 12, marginBottom: 8 }}>
                    {project.code}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>
                    {project.name}
                  </div>
                  <p style={{ margin: '0 0 14px', lineHeight: 1.55, color: '#5d4a31' }}>
                    {project.description ?? 'No project description yet.'}
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    <StatusPill label={project.currentPhase} tone="neutral" />
                    <StatusPill
                      label={`${project.openPendingItemCount} pending`}
                      tone={project.openPendingItemCount > 0 ? 'critical' : 'good'}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      color: '#4f3e29',
                    }}
                  >
                    <div>
                      <strong>{project.doneTaskCount}</strong> / {project.taskCount} tasks done
                    </div>
                    <div>
                      <strong>{project.releasedDeliverableCount}</strong> /{' '}
                      {project.deliverableCount} deliverables released
                    </div>
                    <div>Owner: {project.ownerName ?? 'Unassigned'}</div>
                    <div>
                      Created:{' '}
                      {new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(
                        project.createdAt,
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Create Project"
          subtitle="Stand up a new regulated program record without leaving the portfolio board."
          tone="dark"
        >
          <form action={createProjectForm} style={{ display: 'grid', gap: 10 }}>
            <input name="code" placeholder="Project code" style={darkInputStyle} />
            <input name="name" placeholder="Project name" style={darkInputStyle} />
            <textarea
              name="description"
              placeholder="Short project description"
              style={{ ...darkInputStyle, minHeight: 100, resize: 'vertical' }}
            />
            <select name="currentPhase" defaultValue={ProjectPhase.Concept} style={darkInputStyle}>
              {Object.values(ProjectPhase).map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
            <select name="ownerId" defaultValue="" style={darkInputStyle}>
              <option value="">Assign PM owner later</option>
              {ownerOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.role}
                </option>
              ))}
            </select>
            <button type="submit" style={lightButtonStyle}>
              Create Project
            </button>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  )
}

const baseInputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  padding: '14px 16px',
  fontSize: 15,
  boxSizing: 'border-box',
}

const darkInputStyle: CSSProperties = {
  ...baseInputStyle,
  background: 'rgba(255, 244, 228, 0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  color: '#fff7ec',
}

const lightButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#fff4df',
  color: '#442e17',
  fontWeight: 700,
}

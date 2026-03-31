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
import { formatDateZh, formatProjectPhase, formatRole } from '@/lib/ui-labels'
import type { Role } from '@prisma/client'
import { ProjectsPageClient } from './ProjectsPageClient'

type SearchParams = { notice?: string; error?: string }

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
  const [projects, lookup] = await Promise.all([
    getProjectSummaries(),
    getWorkspaceLookupData(),
  ])

  const urlState = await searchParams

  const openPendingProjects = projects.filter((project) => project.openPendingItemCount > 0).length
  const portfolioDoneRate = projects.length
    ? `${projects.reduce((sum, project) => sum + project.doneTaskCount, 0)}/${projects.reduce((sum, project) => sum + project.taskCount, 0)}`
    : '0/0'
  const ownerOptions = lookup.users.filter(
    (user) => user.role === 'PM' || user.role === 'ADMIN',
  )

  return (
    <ProjectsPageClient
      projects={projects}
      urlState={urlState}
      ownerOptions={ownerOptions}
      portfolioDoneRate={portfolioDoneRate}
      openPendingProjects={openPendingProjects}
    />
  )
}

'use client'

import React, { useState } from 'react'
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'

interface ProjectGanttProps {
  tasks: any[]
  onTaskClick?: (taskId: string) => void
}

export function ProjectGantt({ tasks, onTaskClick }: ProjectGanttProps) {
  const [view, setView] = useState<ViewMode>(ViewMode.Day)

  if (!tasks || tasks.length === 0) {
    return <div style={{ color: '#6d5942', padding: 14 }}>尚無足夠的任務資料可產生甘特圖</div>
  }

  const transformedTasks: GanttTask[] = tasks.map(task => {
    let progress = 0
    if (task.status === 'InProgress') progress = 50
    if (task.status === 'Done') progress = 100

    // 安全地轉換日期，防止無效日期值
    const toDate = (d: any): Date => {
      if (!d) return new Date()
      const date = new Date(d)
      if (isNaN(date.getTime())) return new Date()
      return date
    }

    const start = toDate(task.plannedStartDate) || toDate(task.createdAt) || new Date()
    const end = toDate(task.targetDate) || new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000)

    let bgColor = '#0b89a6' // Todo
    if (task.status === 'InProgress') bgColor = '#b9711f'
    if (task.status === 'Done') bgColor = '#0b8a63'

    // 讀取前置任務（blockedBy）並轉換為 dependencies 陣列
    const dependencies: string[] = task.blockedBy?.map((b: any) => b.id) || []

    return {
      id: task.id,
      name: `[${task.code}] ${task.title}`,
      type: 'task',
      progress,
      start,
      end,
      dependencies,
      styles: {
        backgroundColor: bgColor,
        backgroundSelectedColor: bgColor,
        progressColor: 'rgba(255,255,255,0.25)',
        progressSelectedColor: 'rgba(255,255,255,0.25)',
      }
    }
  })

  // Prevent timeline from cutting off by adding some buffer if there's only one task
  if (transformedTasks.length === 1) {
    const singleTask = transformedTasks[0]
    const bufferTask: GanttTask = {
      ...singleTask,
      id: 'buffer_end',
      name: '',
      start: new Date(singleTask.end.getTime() + 1),
      end: new Date(singleTask.end.getTime() + 2 * 24 * 60 * 60 * 1000),
      styles: { backgroundColor: 'transparent', backgroundSelectedColor: 'transparent', progressColor: 'transparent', progressSelectedColor: 'transparent' }
    }
    transformedTasks.push(bufferTask)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setView(ViewMode.Day)} style={viewBtnStyle(view === ViewMode.Day)}>Day</button>
        <button type="button" onClick={() => setView(ViewMode.Week)} style={viewBtnStyle(view === ViewMode.Week)}>Week</button>
        <button type="button" onClick={() => setView(ViewMode.Month)} style={viewBtnStyle(view === ViewMode.Month)}>Month</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <Gantt
          tasks={transformedTasks}
          viewMode={view}
          locale="zh-TW"
          listCellWidth=""
          ganttHeight={transformedTasks.length > 2 ? undefined : 150}
          onClick={(task: GanttTask) => {
            // 忽略 buffer 任務
            if (task.id !== 'buffer_end' && onTaskClick) {
              onTaskClick(task.id as string)
            }
          }}
        />
      </div>
    </div>
  )
}

function viewBtnStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? '1px solid rgba(73, 52, 27, 0.4)' : '1px solid rgba(73, 52, 27, 0.12)',
    background: active ? '#fff4df' : 'rgba(255,255,255,0.68)',
    color: '#442e17',
    padding: '6px 12px',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 700 : 500
  }
}

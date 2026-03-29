import type { ReactNode } from 'react'

import './globals.css'

export const metadata = {
  title: 'Design History File Flow｜醫療器材研發專案管理',
  description: '醫療器材研發專案的 Task、Deliverable、Phase Gate 與 Change Request 控制台',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}

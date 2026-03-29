import type { ReactNode } from 'react'

export const metadata = {
  title: 'Design History File Flow',
  description: 'Pending item and phase-gate tracking for medical device R&D',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="zh-Hant">
      <body
        style={{
          margin: 0,
          fontFamily:
            '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
          background:
            'linear-gradient(180deg, #f6f1e7 0%, #efe4d2 45%, #e3d3bd 100%)',
          color: '#2d2418',
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  )
}

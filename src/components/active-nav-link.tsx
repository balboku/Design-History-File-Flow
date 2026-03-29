'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function ActiveNavLink({
  href,
  label,
  caption,
}: {
  href: string
  label: string
  caption: string
}) {
  const pathname = usePathname()
  const isActive =
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))

  return (
    <Link
      href={href}
      style={{
        borderRadius: 20,
        padding: '14px 16px',
        textDecoration: 'none',
        color: '#f5fbfc',
        background: isActive
          ? 'linear-gradient(135deg, rgba(25, 177, 209, 0.28), rgba(255,255,255,0.12))'
          : 'rgba(255,255,255,0.05)',
        border: isActive
          ? '1px solid rgba(158, 236, 255, 0.44)'
          : '1px solid rgba(255,255,255,0.09)',
        boxShadow: isActive ? '0 14px 32px rgba(0, 0, 0, 0.18)' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 4,
        }}
      >
        <div style={{ fontWeight: 700 }}>{label}</div>
        {isActive ? (
          <span
            style={{
              borderRadius: 999,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 700,
              color: '#083946',
              background: '#c9f2fb',
            }}
          >
            目前
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(224, 245, 250, 0.74)' }}>{caption}</div>
    </Link>
  )
}

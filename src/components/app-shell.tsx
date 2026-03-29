import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'

export interface NavItem {
  href: string
  label: string
  caption: string
}

const navItems: NavItem[] = [
  { href: '/', label: 'Overview', caption: 'Mission control' },
  { href: '/projects', label: 'Projects', caption: 'Program portfolio' },
  { href: '/tasks', label: 'Tasks', caption: 'Execution stream' },
  { href: '/deliverables', label: 'Deliverables', caption: 'Compliance outputs' },
  { href: '/phase-gates', label: 'Phase Gates', caption: 'Go / no-go review' },
  { href: '/change-requests', label: 'Change Requests', caption: 'Post-transfer control' },
  { href: '/pending-items', label: 'Pending Items', caption: 'Work-at-risk carryovers' },
]

export function AppShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string
  eyebrow: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(255, 247, 232, 0.95), rgba(228, 205, 176, 0.92) 34%, rgba(189, 155, 116, 0.88) 100%)',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '28px 20px 72px',
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr)',
          gap: 24,
        }}
      >
        <aside
          style={{
            borderRadius: 28,
            padding: 24,
            background: 'rgba(63, 43, 22, 0.82)',
            color: '#f6ecdd',
            boxShadow: '0 30px 80px rgba(57, 37, 16, 0.22)',
            position: 'sticky',
            top: 20,
            alignSelf: 'start',
          }}
        >
          <div style={{ marginBottom: 26 }}>
            <p
              style={{
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                fontSize: 11,
                color: 'rgba(255, 240, 220, 0.72)',
              }}
            >
              Design History File Flow
            </p>
            <h1
              style={{
                margin: '14px 0 8px',
                fontSize: 32,
                lineHeight: 1,
                color: '#fff7ed',
              }}
            >
              Regulated Agile
            </h1>
            <p
              style={{
                margin: 0,
                lineHeight: 1.6,
                color: 'rgba(255, 241, 222, 0.78)',
              }}
            >
              Keep engineers moving, make risk visible, and leave a clean audit
              trail behind every exception.
            </p>
          </div>

          <nav style={{ display: 'grid', gap: 10 }}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  borderRadius: 18,
                  padding: '14px 16px',
                  textDecoration: 'none',
                  color: '#fff7ed',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: 'rgba(255, 239, 217, 0.72)' }}>
                  {item.caption}
                </div>
              </Link>
            ))}
          </nav>
        </aside>

        <main>
          <header
            style={{
              borderRadius: 30,
              padding: 28,
              background:
                'linear-gradient(135deg, rgba(255, 248, 238, 0.9), rgba(255, 239, 218, 0.55))',
              border: '1px solid rgba(76, 53, 27, 0.12)',
              boxShadow: '0 26px 80px rgba(57, 37, 16, 0.1)',
              marginBottom: 22,
            }}
          >
            <p
              style={{
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                fontSize: 11,
                color: '#896945',
              }}
            >
              {eyebrow}
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 20,
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div style={{ maxWidth: 760 }}>
                <h2
                  style={{
                    margin: '10px 0 10px',
                    fontSize: 'clamp(2.4rem, 5vw, 4.4rem)',
                    lineHeight: 0.95,
                    color: '#2f2418',
                  }}
                >
                  {title}
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 18,
                    lineHeight: 1.65,
                    color: '#4a3925',
                  }}
                >
                  {description}
                </p>
              </div>
              {actions ? <div>{actions}</div> : null}
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>
  )
}

export function SectionCard({
  title,
  subtitle,
  children,
  tone = 'light',
}: {
  title: string
  subtitle?: string
  children: ReactNode
  tone?: 'light' | 'dark'
}) {
  const isDark = tone === 'dark'

  return (
    <section
      style={{
        borderRadius: 26,
        padding: 22,
        background: isDark
          ? 'rgba(72, 49, 26, 0.88)'
          : 'rgba(255, 248, 239, 0.78)',
        color: isDark ? '#fef6eb' : '#2f2418',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(73, 52, 27, 0.12)'}`,
        boxShadow: isDark
          ? '0 24px 60px rgba(49, 31, 15, 0.24)'
          : '0 20px 60px rgba(57, 37, 16, 0.08)',
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 24 }}>{title}</h3>
        {subtitle ? (
          <p
            style={{
              margin: '6px 0 0',
              color: isDark ? 'rgba(255, 241, 222, 0.76)' : '#675139',
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function MetricCard({
  label,
  value,
  hint,
  accent = '#6d4927',
}: {
  label: string
  value: string
  hint?: string
  accent?: string
}) {
  return (
    <div
      style={{
        borderRadius: 24,
        padding: 20,
        background: 'rgba(255, 248, 239, 0.72)',
        border: '1px solid rgba(73, 52, 27, 0.12)',
        boxShadow: '0 18px 40px rgba(57, 37, 16, 0.08)',
      }}
    >
      <div
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontSize: 11,
          color: '#896945',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, color: accent }}>{value}</div>
      {hint ? (
        <div style={{ marginTop: 8, lineHeight: 1.5, color: '#63503a' }}>{hint}</div>
      ) : null}
    </div>
  )
}

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'good' | 'warn' | 'critical'
}) {
  const palette =
    tone === 'good'
      ? { background: 'rgba(59, 126, 75, 0.12)', color: '#2f6d3a' }
      : tone === 'warn'
        ? { background: 'rgba(173, 103, 45, 0.14)', color: '#8a4e22' }
        : tone === 'critical'
          ? { background: 'rgba(155, 67, 59, 0.14)', color: '#8a2f2c' }
          : { background: 'rgba(108, 90, 65, 0.12)', color: '#5d4a31' }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '7px 12px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        ...palette,
      }}
    >
      {label}
    </span>
  )
}

export function EmptyPanel({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div
      style={{
        borderRadius: 24,
        padding: '32px 24px',
        textAlign: 'center',
        background: 'rgba(255,255,255,0.45)',
        border: '1px dashed rgba(73, 52, 27, 0.18)',
      }}
    >
      <h4 style={{ margin: '0 0 8px', fontSize: 22, color: '#3e2f1f' }}>{title}</h4>
      <p style={{ margin: 0, lineHeight: 1.6, color: '#6b563f' }}>{body}</p>
    </div>
  )
}

export function ActionLink({
  href,
  label,
  tone = 'primary',
}: {
  href: string
  label: string
  tone?: 'primary' | 'secondary'
}) {
  const style: CSSProperties =
    tone === 'primary'
      ? {
          background: '#6b4927',
          color: '#fff7ee',
          border: '1px solid rgba(78, 54, 27, 0.1)',
        }
      : {
          background: 'rgba(255, 248, 239, 0.72)',
          color: '#5a4329',
          border: '1px solid rgba(73, 52, 27, 0.18)',
        }

  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        padding: '13px 18px',
        fontWeight: 700,
        textDecoration: 'none',
        ...style,
      }}
    >
      {label}
    </Link>
  )
}

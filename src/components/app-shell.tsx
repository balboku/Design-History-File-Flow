import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'

import { ActiveNavLink } from './active-nav-link'

export interface NavItem {
  href: string
  label: string
  caption: string
}

const navItems: NavItem[] = [
  { href: '/', label: '總覽', caption: '專案戰情中心' },
  { href: '/projects', label: '專案組合', caption: '專案建立與盤點' },
  { href: '/tasks', label: '開發任務', caption: 'RD 執行流' },
  { href: '/deliverables', label: '合規文件', caption: 'Placeholder 與版次' },
  { href: '/phase-gates', label: '階段關卡', caption: 'Soft / Hard Gate' },
  { href: '/change-requests', label: '變更管理', caption: '設計移轉後控管' },
  { href: '/pending-items', label: '遺留項', caption: '條件式放行追蹤' },
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
    <div style={{ minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">
        略過導覽直接到主內容
      </a>

      <div
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          padding: '24px 18px 72px',
        }}
      >
        <div className="app-shell-grid">
          <aside className="app-shell-sidebar">
            <div
              style={{
                borderRadius: 30,
                padding: 24,
                background:
                  'linear-gradient(180deg, var(--app-sidebar), var(--app-sidebar-soft))',
                color: '#f3fbfc',
                border: '1px solid rgba(189, 236, 247, 0.1)',
                boxShadow: '0 16px 48px rgba(3, 33, 44, 0.18)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderRadius: 24,
                  background:
                    'linear-gradient(135deg, rgba(201, 242, 251, 0.14), rgba(255,255,255,0.06))',
                  border: '1px solid rgba(210, 244, 251, 0.12)',
                  marginBottom: 22,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(218, 245, 250, 0.76)',
                  }}
                >
                  Design History File Flow
                </p>
                <h1
                  style={{
                    margin: '14px 0 10px',
                    fontSize: 30,
                    lineHeight: 1.05,
                    fontFamily:
                      'var(--font-heading), var(--font-body), "Noto Sans TC", sans-serif',
                  }}
                >
                  醫療器材研發
                  <br />
                  合規主控台
                </h1>
                <p
                  style={{
                    margin: 0,
                    lineHeight: 1.75,
                    color: 'rgba(223, 247, 252, 0.82)',
                  }}
                >
                  讓 RD 可以敏捷推進，同時保留 QA 與 PM 所需的設計管制軌跡。
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {['ISO 13485', 'FDA Design Controls', 'Soft Gate'].map((item) => (
                  <span
                    key={item}
                    style={{
                      borderRadius: 999,
                      padding: '7px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#dbf6fb',
                      background: 'rgba(218, 244, 249, 0.12)',
                      border: '1px solid rgba(218, 244, 249, 0.1)',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>

              <nav style={{ display: 'grid', gap: 10 }}>
                {navItems.map((item) => (
                  <ActiveNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    caption={item.caption}
                  />
                ))}
              </nav>
            </div>
          </aside>

          <main id="main-content">
            <header
              style={{
                borderRadius: 32,
                padding: 28,
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(242, 249, 251, 0.88))',
                border: '1px solid var(--app-border)',
                boxShadow: 'var(--app-shadow)',
                marginBottom: 22,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at right top, rgba(11, 137, 166, 0.06), transparent 32%), radial-gradient(circle at 18% 18%, rgba(191, 240, 248, 0.3), transparent 26%)',
                  pointerEvents: 'none',
                }}
              />

              <div style={{ position: 'relative' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--app-primary-strong)',
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
                  <div style={{ maxWidth: 860 }}>
                    <h2
                      style={{
                        margin: '12px 0 10px',
                        fontSize: 'clamp(2.3rem, 5vw, 4.6rem)',
                        lineHeight: 0.92,
                        color: 'var(--app-text)',
                        fontFamily:
                          'var(--font-heading), var(--font-body), "Noto Sans TC", sans-serif',
                      }}
                    >
                      {title}
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 18,
                        lineHeight: 1.8,
                        color: 'var(--app-text-soft)',
                        maxWidth: 760,
                      }}
                    >
                      {description}
                    </p>
                  </div>
                  {actions ? <div>{actions}</div> : null}
                </div>
              </div>
            </header>

            {children}
          </main>
        </div>
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
      className={
        isDark
          ? 'rounded-[28px] border border-[rgba(203,241,248,0.08)] bg-[linear-gradient(180deg,rgba(12,88,108,0.85),rgba(10,68,84,0.82))] p-[22px] text-[#f2fbfc] shadow-[0_12px_32px_rgba(4,31,40,0.14)]'
          : 'rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-[22px] text-[var(--app-text)] shadow-[0_8px_24px_rgba(8,41,54,0.05)]'
      }
    >
      <div style={{ marginBottom: 18 }}>
        <h3
          className='m-0 text-2xl [font-family:var(--font-heading),var(--font-body),"Noto_Sans_TC",sans-serif]'
        >
          {title}
        </h3>
        {subtitle ? (
          <p
            className={
              isDark
                ? 'mt-1.5 mb-0 leading-[1.7] text-[rgba(221,245,250,0.78)]'
                : 'mt-1.5 mb-0 leading-[1.7] text-[var(--app-text-soft)]'
            }
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
  accent = 'var(--app-primary-strong)',
}: {
  label: string
  value: string
  hint?: string
  accent?: string
}) {
  return (
    <div
      className="rounded-[24px] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,250,0.92))] p-5 shadow-[0_6px_18px_rgba(8,41,54,0.04)]"
    >
      <div
        className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[var(--app-text-soft)]"
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: accent,
          fontFamily:
            'var(--font-heading), var(--font-body), "Noto Sans TC", sans-serif',
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 8, lineHeight: 1.6, color: 'var(--app-text-soft)' }}>
          {hint}
        </div>
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
      ? { background: 'rgba(11, 138, 99, 0.12)', color: 'var(--app-success)' }
      : tone === 'warn'
        ? { background: 'rgba(185, 113, 31, 0.12)', color: 'var(--app-accent)' }
        : tone === 'critical'
          ? { background: 'rgba(191, 74, 60, 0.12)', color: 'var(--app-danger)' }
          : { background: 'rgba(11, 99, 120, 0.1)', color: 'var(--app-primary-strong)' }

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-[7px] text-xs font-bold tracking-[0.04em]"
      style={palette}
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
      className="rounded-[24px] border border-dashed border-[rgba(11,99,120,0.2)] bg-[var(--app-surface-soft)] px-6 py-[34px] text-center"
    >
      <h4
        className='m-0 mb-2 text-[22px] text-[var(--app-text)] [font-family:var(--font-heading),var(--font-body),"Noto_Sans_TC",sans-serif]'
      >
        {title}
      </h4>
      <p className="m-0 leading-[1.7] text-[var(--app-text-soft)]">{body}</p>
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
          background:
            'linear-gradient(135deg, var(--app-primary), var(--app-primary-strong))',
          color: '#f5fbfc',
          border: '1px solid rgba(5, 86, 103, 0.14)',
          boxShadow: '0 8px 20px rgba(11, 99, 120, 0.14)',
        }
      : {
          background: 'rgba(255, 255, 255, 0.78)',
          color: 'var(--app-primary-strong)',
          border: '1px solid var(--app-border)',
        }

  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full px-[18px] py-[13px] font-bold no-underline transition hover:-translate-y-0.5"
      style={style}
    >
      {label}
    </Link>
  )
}

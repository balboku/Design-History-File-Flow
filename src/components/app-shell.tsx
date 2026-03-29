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
                border: '1px solid rgba(189, 236, 247, 0.14)',
                boxShadow: '0 28px 80px rgba(3, 33, 44, 0.28)',
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

              <div
                style={{
                  marginTop: 20,
                  borderRadius: 22,
                  padding: 16,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ fontSize: 12, color: 'rgba(223, 247, 252, 0.7)' }}>
                  介面風格
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontWeight: 700,
                    fontSize: 18,
                    color: '#f2fbfc',
                  }}
                >
                  信任感 + 資料密度 + 可稽核
                </div>
                <div style={{ marginTop: 8, lineHeight: 1.7, color: 'rgba(223, 247, 252, 0.78)' }}>
                  依據 `ui-ux-pro-max` 的醫療 / 企業儀表板建議，採用清爽藍綠配色、
                  高對比資訊卡與明確狀態提示。
                </div>
              </div>
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
                    'radial-gradient(circle at right top, rgba(11, 137, 166, 0.12), transparent 32%), radial-gradient(circle at 18% 18%, rgba(191, 240, 248, 0.6), transparent 26%)',
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
      style={{
        borderRadius: 28,
        padding: 22,
        background: isDark
          ? 'linear-gradient(180deg, rgba(10, 73, 90, 0.96), rgba(8, 58, 72, 0.94))'
          : 'var(--app-surface)',
        color: isDark ? '#f2fbfc' : 'var(--app-text)',
        border: isDark
          ? '1px solid rgba(203, 241, 248, 0.12)'
          : '1px solid var(--app-border)',
        boxShadow: isDark
          ? '0 24px 64px rgba(4, 31, 40, 0.22)'
          : '0 18px 50px rgba(8, 41, 54, 0.08)',
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 24,
            fontFamily:
              'var(--font-heading), var(--font-body), "Noto Sans TC", sans-serif',
          }}
        >
          {title}
        </h3>
        {subtitle ? (
          <p
            style={{
              margin: '6px 0 0',
              color: isDark ? 'rgba(221, 245, 250, 0.78)' : 'var(--app-text-soft)',
              lineHeight: 1.7,
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
  accent = 'var(--app-primary-strong)',
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
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(243, 249, 250, 0.94))',
        border: '1px solid var(--app-border)',
        boxShadow: '0 18px 42px rgba(8, 41, 54, 0.08)',
      }}
    >
      <div
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontSize: 11,
          color: 'var(--app-text-soft)',
          marginBottom: 8,
        }}
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
        padding: '34px 24px',
        textAlign: 'center',
        background: 'var(--app-surface-soft)',
        border: '1px dashed rgba(11, 99, 120, 0.2)',
      }}
    >
      <h4
        style={{
          margin: '0 0 8px',
          fontSize: 22,
          color: 'var(--app-text)',
          fontFamily:
            'var(--font-heading), var(--font-body), "Noto Sans TC", sans-serif',
        }}
      >
        {title}
      </h4>
      <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--app-text-soft)' }}>{body}</p>
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
          boxShadow: '0 14px 30px rgba(11, 99, 120, 0.22)',
        }
      : {
          background: 'rgba(255, 255, 255, 0.78)',
          color: 'var(--app-primary-strong)',
          border: '1px solid var(--app-border)',
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

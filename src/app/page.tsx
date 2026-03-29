import Link from 'next/link'

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '64px 24px 96px',
      }}
    >
      <section
        style={{
          background: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(75, 56, 34, 0.16)',
          borderRadius: 24,
          padding: 32,
          boxShadow: '0 24px 60px rgba(71, 49, 24, 0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <p
          style={{
            margin: 0,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontSize: 12,
            color: '#7b6142',
          }}
        >
          DHF Flow
        </p>
        <h1
          style={{
            margin: '12px 0 16px',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            lineHeight: 1,
          }}
        >
          Pending Item Console
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 640,
            fontSize: 18,
            lineHeight: 1.6,
            color: '#4c3a25',
          }}
        >
          Inspect work-at-risk carryovers, review unresolved compliance gaps, and
          close pending items only when their linked deliverables are properly
          released.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginTop: 28,
          }}
        >
          <Link
            href="/pending-items"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 20px',
              borderRadius: 999,
              background: '#67462a',
              color: '#fff8ee',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Open Pending Items
          </Link>
          <a
            href="/api/project/phase"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 20px',
              borderRadius: 999,
              border: '1px solid rgba(75, 56, 34, 0.24)',
              color: '#5c4428',
              textDecoration: 'none',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.45)',
            }}
          >
            API Entry Point
          </a>
        </div>
      </section>
    </main>
  )
}

import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'

export function ErrorView({ error }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', color: '#A6C2BB', background: '#061C19', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <h1 style={{ fontSize: '1.6rem', color: '#E6F2EF', margin: 0 }}>Something went wrong</h1>
        <p>{error instanceof Error ? error.message : 'Unexpected error.'}</p>
        <button onClick={() => router.invalidate()} style={{ background: '#0FFFA1', color: '#05221E', border: 0, borderRadius: 6, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Try again</button>
      </div>
    </main>
  )
}

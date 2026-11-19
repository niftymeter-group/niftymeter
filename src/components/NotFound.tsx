export function NotFound() {
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', color: '#A6C2BB', background: '#061C19' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', color: '#E6F2EF', margin: 0 }}>Not found</h1>
        <p><a href="/" style={{ color: '#0FFFA1' }}>← Back to the home page</a></p>
      </div>
    </main>
  )
}

import type { FormEvent, ReactNode } from 'react'
import { assetUrl } from '~/lib/util'

export function AuthCard({ logo, siteName, children, onSubmit, wide }: { logo: string; siteName: string; children: ReactNode; onSubmit?: (e: FormEvent) => void; wide?: boolean }) {
  return (
    <form className="auth-card" style={wide ? { maxWidth: 640 } : undefined} onSubmit={(e) => { e.preventDefault(); onSubmit?.(e) }} autoComplete="on">
      <img src={assetUrl(logo)} alt={siteName} className="auth-logo" />
      {children}
    </form>
  )
}

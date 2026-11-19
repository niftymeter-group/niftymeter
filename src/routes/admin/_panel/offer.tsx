import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { FieldList, stripKeys, useFieldState } from '~/components/admin/Fields'
import { useAction } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { getAdminSettings, getOfferStats, saveGroup } from '~/fns/admin'
import { OFFER_BROKER, OFFER_GENERAL, OFFER_PRICING } from '~/lib/schemas'
import { brokerDisclaimer } from '~/lib/site'
import { assetUrl, lines } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/offer')({
  loader: async () => { const [s, stats] = await Promise.all([getAdminSettings(), getOfferStats()]); return { ...s, stats } },
  component: Offer,
})

const ALL = [...OFFER_GENERAL, ...OFFER_PRICING, ...OFFER_BROKER]
const PLACEMENT: Record<string, string> = { pricing: 'Pricing card', strip: 'Partner strip', success: 'After trial sign-up' }

function Offer() {
  const d = Route.useLoaderData()
  const S = d.S as Record<string, string>
  const st = useFieldState(ALL, d.S)
  const save = useServerFn(saveGroup)
  const run = useAction()
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!st.dirty) st.reset(d.S) }, [d.S]) // eslint-disable-line react-hooks/exhaustive-deps
  const model = S.offer_model
  const t = d.stats
  return (
    <Page title="Pricing & Broker" sub="Choose what your Pricing section offers: a one-time price, or free access through your partner broker (AP).">
      <div className="stat-grid">
        <div className="card stat"><div className="stat-lbl">Pricing section</div><div className="stat-num" style={{ fontSize: '1.3rem' }}>{S.show_pricing === '1' ? 'Visible' : 'Hidden'}</div><div className="stat-hint">showing: {model === 'broker' ? 'broker card' : 'price card'}</div></div>
        <div className="card stat"><div className="stat-lbl">Broker clicks · 7 days</div><div className="stat-num accent">{t.broker7}</div><div className="stat-hint">AP link opened</div></div>
        <div className="card stat"><div className="stat-lbl">Broker clicks · 30 days</div><div className="stat-num">{t.broker30}</div><div className="stat-hint">{t.brokerAll} all time</div></div>
        <div className="card stat"><div className="stat-lbl">Buy clicks · 30 days</div><div className="stat-num">{t.buy30}</div><div className="stat-hint">payment link opened</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Live card preview</h2><a className="small" href="/#pricing" target="_blank" rel="noopener">See on site ↗</a></div>
          <div className="offer-preview">
            {model === 'broker' ? (
              <>
                <div className="op-head"><img src={assetUrl(S.broker_logo)} alt="" style={{ height: Number(S.broker_logo_height) || 36 }} /><span className="badge st-converted">{S.broker_badge}</span></div>
                <div className="op-title">{S.broker_offer}</div>
                <div className="muted small">{S.broker_offer_note}</div>
                <ul>{lines(S.broker_benefits).slice(0, 5).map((l, i) => <li key={i}>{l}</li>)}</ul>
                <div className="op-btn">{S.broker_btn}</div>
                <p className="muted small">{brokerDisclaimer(d.S)}</p>
              </>
            ) : (
              <>
                <span className="badge st-converted">{S.price_badge}</span>
                <div className="op-title" style={{ marginTop: 10 }}>{S.price_name}</div>
                <div className="op-price">{S.price_mrp && <><s>{S.price_mrp}</s> </>}{S.price_amount} <small>{S.price_unit}</small></div>
                <div className="muted small">{S.price_note}</div>
                <ul>{lines(S.price_features).slice(0, 6).map((l, i) => <li key={i}>{l}</li>)}</ul>
                <div className="op-btn">{S.price_btn}</div>
                {!S.price_link && <p className="help warn-text">⚠ No payment link — the button scrolls to the enquiry form.</p>}
              </>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Broker clicks (30 days)</h2></div>
          {!t.bySrc.length ? <p className="muted">No clicks yet. Clicks on any broker button are counted here.</p> : (
            <>
              <table className="table compact"><thead><tr><th>Placement</th><th className="num">Clicks</th></tr></thead><tbody>
                {t.bySrc.map((r, i) => <tr key={i}><td>{PLACEMENT[String(r.s)] ?? String(r.s)}</td><td className="num">{Number(r.n)}</td></tr>)}
              </tbody></table>
              <table className="table compact" style={{ marginTop: 12 }}><thead><tr><th>Visitor source</th><th className="num">Clicks</th></tr></thead><tbody>
                {t.byUtm.map((r, i) => <tr key={i}><td>{String(r.s)}</td><td className="num">{Number(r.n)}</td></tr>)}
              </tbody></table>
            </>
          )}
          <p className="help">Account openings are confirmed in your broker's AP back-office. Mark matching leads as <span className="badge st-converted">converted</span> in Leads to track results per campaign.</p>
        </div>
      </div>

      <form className="card settings-form" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true)
        const r = await run(() => save({ data: { group: 'offer', values: stripKeys(st.values) } }))
        setBusy(false); if (r) st.setDirty(false)
      }}>
        <div className="form-grid">
          <FieldList fields={OFFER_GENERAL} values={st.values} set={st.set} />
          <div className="wide offer-tabs">
            <details open={st.values.offer_model !== 'broker'}><summary>💳 One-time price card</summary><div className="form-grid"><FieldList fields={OFFER_PRICING} values={st.values} set={st.set} /></div></details>
            <details open={st.values.offer_model === 'broker'}><summary>🤝 Partner broker (AP)</summary><div className="form-grid"><FieldList fields={OFFER_BROKER} values={st.values} set={st.set} /></div></details>
          </div>
        </div>
        <div className="form-actions sticky-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : '💾 Save'}</button><a className="btn btn-ghost" href="/#pricing" target="_blank" rel="noopener">View site ↗</a></div>
      </form>
    </Page>
  )
}

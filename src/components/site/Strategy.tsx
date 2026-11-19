/** Strategy window (bull / bear walkthrough) — port of the site.js controller, scoped to this component. */
import { useEffect, useMemo, useRef } from 'react'
import { esc } from '~/lib/util'
import { STRATEGY_HTML } from './strategy.html'

type Wp = { x: number; y: number; label: string; val: string; sig: string; cls: string; ms: number; show: string[]; hide: string[] }

const WAYPOINTS: Record<'bull' | 'bear', Wp[][]> = {
  bull: [
    [
      { x: .50, y: .40, label: 'STEP 1 — READ THE TREND', val: '15-minute bullish example', sig: 'Are the tops getting higher?', cls: 'gold', ms: 1800, show: [], hide: [] },
      { x: .30, y: .30, label: 'HIGHER HIGHS', val: 'Each rise goes higher', sig: '✅ Buyers are in control', cls: 'pos', ms: 2000, show: ['bs1-box', 'bs1-boxtxt'], hide: [] },
      { x: .39, y: .09, label: 'NEW HIGH', val: 'Price made a fresh high', sig: 'Trend is up', cls: 'pos', ms: 1800, show: ['bs1-ring'], hide: [] },
    ],
    [
      { x: .12, y: .83, label: 'LOOK AT THE BANDS', val: 'NiftyMeter strip at the bottom', sig: 'What colour is it?', cls: 'gold', ms: 1600, show: [], hide: ['bs1-box', 'bs1-boxtxt', 'bs1-ring'] },
      { x: .228, y: .78, label: 'WHITE → GREEN', val: 'Trade zone starts', sig: '✅ Bullish & tradeable', cls: 'pos', ms: 2000, show: ['bs1-price', 'bs1-pricetxt'], hide: [] },
      { x: .316, y: .83, label: 'GREEN BANDS', val: 'Bullish · Tradeable', sig: '✅ Look for a buy entry', cls: 'pos', ms: 2000, show: ['bs1-trend', 'bs1-trendtxt'], hide: [] },
      { x: .431, y: .83, label: 'WHITE BANDS', val: 'Not tradeable', sig: 'Book profit — no new trades', cls: 'gold', ms: 2000, show: ['bs1-dark', 'bs1-darktxt', 'bs1-darktxt2'], hide: [] },
    ],
    [
      { x: .12, y: .33, label: 'PREVIOUS HIGH', val: 'The level to beat', sig: '👀 Wait for a close above it', cls: 'gold', ms: 1800, show: ['bs2-hl', 'bs2-hl-lbl', 'bs2-hl-txt'], hide: ['bs1-trend', 'bs1-trendtxt', 'bs1-price', 'bs1-pricetxt', 'bs1-dark', 'bs1-darktxt', 'bs1-darktxt2'] },
      { x: .307, y: .27, label: 'ENTRY', val: 'Candle closed above the high', sig: '✅ Green bands + breakout', cls: 'pos', ms: 2000, show: ['bs2-zone', 'bs2-arrow', 'bs2-lbl', 'bs2-txt'], hide: [] },
      { x: .38, y: .38, label: 'STOP LOSS', val: 'Below the breakout candle', sig: 'Keeps a wrong trade small', cls: 'neg', ms: 1800, show: ['bs3-sl', 'bs3-sltxt'], hide: [] },
      { x: .44, y: .07, label: 'TARGET', val: 'Next resistance', sig: '💰 Exit when bands turn white', cls: 'pos', ms: 2000, show: ['bs3-profit', 'bs3-ptxt', 'bs3-tp', 'bs3-tp1', 'bs3-tp2', 'bs3-be', 'bs3-betxt'], hide: [] },
    ],
  ],
  bear: [
    [
      { x: .50, y: .40, label: 'STEP 1 — READ THE TREND', val: '15-minute bearish example', sig: 'Are the tops getting lower?', cls: 'gold', ms: 1800, show: [], hide: [] },
      { x: .40, y: .16, label: 'LOWER HIGHS', val: 'Each bounce is weaker', sig: '❌ Sellers are in control', cls: 'neg', ms: 2000, show: ['brs1-box', 'brs1-boxtxt'], hide: [] },
      { x: .598, y: .63, label: 'BIG RED CANDLE', val: 'Sharp fall', sig: '⚠ Warning sign for holders', cls: 'neg', ms: 1800, show: ['brs1-ring'], hide: [] },
    ],
    [
      { x: .25, y: .83, label: 'LOOK AT THE BANDS', val: 'NiftyMeter strip at the bottom', sig: 'What colour is it?', cls: 'gold', ms: 1600, show: [], hide: ['brs1-box', 'brs1-boxtxt', 'brs1-ring'] },
      { x: .508, y: .83, label: 'RED BANDS', val: 'Bearish · Tradeable', sig: '❌ Avoid buying, exit longs', cls: 'neg', ms: 2000, show: ['brs1-trend', 'brs1-trendtxt'], hide: [] },
      { x: .745, y: .83, label: 'WHITE BANDS', val: 'Not tradeable', sig: 'Stay out — wait', cls: 'gold', ms: 1800, show: ['brs1-dark', 'brs1-darktxt', 'brs1-darktxt2'], hide: [] },
      { x: .831, y: .83, label: 'RED AGAIN', val: 'Downtrend resumes', sig: 'Tradeable again — protect capital', cls: 'neg', ms: 2000, show: ['brs1-price', 'brs1-pricetxt'], hide: [] },
    ],
    [
      { x: .10, y: .31, label: 'PREVIOUS LOW', val: 'Support level', sig: '👀 Watch for a close below it', cls: 'gold', ms: 1800, show: ['brs2-ll', 'brs2-ll-lbl', 'brs2-ll-txt'], hide: ['brs1-trend', 'brs1-trendtxt', 'brs1-price', 'brs1-pricetxt', 'brs1-dark', 'brs1-darktxt', 'brs1-darktxt2'] },
      { x: .446, y: .33, label: 'EXIT / SHORT', val: 'Candle closed below the low', sig: '❌ Red bands + breakdown', cls: 'neg', ms: 2000, show: ['brs2-zone', 'brs2-arrow', 'brs2-lbl', 'brs2-txt'], hide: [] },
      { x: .54, y: .21, label: 'STOP LOSS', val: 'Above the last swing high', sig: 'Limits the risk', cls: 'neg', ms: 1800, show: ['brs3-sl', 'brs3-sltxt'], hide: [] },
      { x: .655, y: .64, label: 'TARGET', val: 'Next support', sig: '💰 Cover when bands turn white', cls: 'neg', ms: 2000, show: ['brs3-profit', 'brs3-ptxt', 'brs3-tp', 'brs3-tp1', 'brs3-tp2', 'brs3-be', 'brs3-betxt'], hide: [] },
    ],
  ],
}

export function Strategy({ siteName }: { siteName: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = useMemo(() => STRATEGY_HTML.split('{{SITE}}').join(esc(siteName)), [siteName])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const $ = <E extends Element = HTMLElement>(id: string) => root.querySelector<E & HTMLElement>('#' + id)
    const $$ = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel))
    const vpEl = $('sw-viewport')
    if (!vpEl) return

    let scenario: 'bull' | 'bear' = 'bull'
    let cur = 0
    const total = 3
    let autoTimer: ReturnType<typeof setInterval> | undefined
    let autoOn = false
    let wpTimer: ReturnType<typeof setTimeout> | undefined
    let wpIdx = 0
    let userOver = false
    let cx = 0.5, cy = 0.5, tx = 0.5, ty = 0.5
    let raf = 0
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }

    const allAnns: string[] = []
    for (const g of ['bull-anns', 'bear-anns']) {
      const el = $(g)
      if (el) el.querySelectorAll('[id]').forEach((n) => allAnns.push(n.id))
    }
    const cursorG = $('svg-cursor')!
    const curH = $('cur-h')!, curV = $('cur-v')!, curDot = $('cur-dot')!, curRing = $('cur-ring')!, curRing2 = $('cur-ring2')!
    const tooltip = $('sw-tooltip')!, ttLabel = $('tt-label')!, ttVal = $('tt-val')!, ttSig = $('tt-sig')!

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const setOps = (ids: string[], op: string) => ids.forEach((id) => { const el = $(id); if (el) el.style.opacity = op })

    function moveCursor(px: number, py: number) {
      const sx = String(px * 1000), sy = String(py * 560)
      curH.setAttribute('y1', sy); curH.setAttribute('y2', sy)
      curV.setAttribute('x1', sx); curV.setAttribute('x2', sx)
      for (const c of [curDot, curRing, curRing2]) { c.setAttribute('cx', sx); c.setAttribute('cy', sy) }
      const rect = vpEl!.getBoundingClientRect()
      let ttx = px * rect.width + 20, tty = py * rect.height - 15
      const tw = tooltip.offsetWidth || 230
      if (ttx + tw + 10 > rect.width) ttx = px * rect.width - tw - 20
      if (ttx < 5) ttx = 5
      if (tty + 130 > rect.height) tty = py * rect.height - 140
      if (tty < 5) tty = py * rect.height + 20
      tooltip.style.left = ttx + 'px'; tooltip.style.top = tty + 'px'
    }
    function showTip(label: string, val: string, sig: string, cls: string) {
      tooltip.style.display = 'block'
      ttLabel.textContent = label; ttVal.textContent = val; ttSig.textContent = sig
      ttSig.className = 'tt-val ' + cls
    }
    const loop = () => {
      cx = lerp(cx, tx, 0.04); cy = lerp(cy, ty, 0.04)
      moveCursor(cx, cy)
      if (alive) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const resetAllAnns = () => setOps(allAnns, '0')
    function showDescSlide(sc: string, idx: number) {
      for (const s of ['bull', 'bear']) for (const i of [0, 1, 2]) { const el = $('desc-' + s + '-' + i); if (el) el.style.display = 'none' }
      const t = $('desc-' + sc + '-' + idx)
      if (t) t.style.display = 'block'
    }
    function runWaypoints(sc: 'bull' | 'bear', slideIdx: number) {
      clearTimeout(wpTimer); wpIdx = 0
      const wps = WAYPOINTS[sc][slideIdx] ?? []
      if (!wps.length) return
      const doWp = () => {
        if (userOver || wpIdx >= wps.length || !alive) return
        const wp = wps[wpIdx]!
        tx = wp.x; ty = wp.y
        showTip(wp.label, wp.val, wp.sig, wp.cls)
        setOps(wp.show, '1'); setOps(wp.hide, '0')
        wpIdx++
        wpTimer = setTimeout(doWp, wp.ms || 800)
      }
      wpTimer = setTimeout(doWp, 500)
    }
    function markStep(n: number) {
      $$('.sw-pill').forEach((p, i) => p.classList.toggle('active', i === n))
      $$('.sw-prog-dot').forEach((d, i) => d.classList.toggle('active', i === n))
      $$('.sw-tab').forEach((t, i) => t.classList.toggle('active', i === n))
      $('sw-step-label')!.textContent = `Step ${n + 1} of ${total}`
    }
    function goToSlide(n: number) {
      cur = (n + total) % total
      markStep(cur)
      resetAllAnns()
      showDescSlide(scenario, cur)
      if (!userOver) runWaypoints(scenario, cur)
    }
    function switchScenario(sc: 'bull' | 'bear') {
      scenario = sc
      $('img-bull')!.style.display = sc === 'bull' ? 'block' : 'none'
      $('img-bear')!.style.display = sc === 'bear' ? 'block' : 'none'
      $('sw-chart-title')!.textContent = `${siteName} · ${sc === 'bull' ? 'BULLISH' : 'BEARISH'} EXAMPLE · 15M`
      $$('.sw-scenario').forEach((b, i) => b.classList.toggle('active', i === (sc === 'bull' ? 0 : 1)))
      resetAllAnns()
      cur = 0
      markStep(0)
      showDescSlide(sc, 0)
      if (!userOver) runWaypoints(sc, 0)
    }
    const playBtn = $('sw-play-btn')!
    function startAuto() {
      autoOn = true
      playBtn.innerHTML = '&#9646;&#9646;'
      clearInterval(autoTimer)
      autoTimer = setInterval(() => { if (!userOver) goToSlide(cur + 1) }, 7000)
    }
    function stopAuto() {
      autoOn = false
      playBtn.innerHTML = '&#9654;'
      clearInterval(autoTimer)
    }

    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-scen],[data-go],[data-nav]')
      if (!t || !root.contains(t)) return
      if (t.dataset.scen) switchScenario(t.dataset.scen as 'bull' | 'bear')
      else if (t.dataset.go !== undefined) goToSlide(Number(t.dataset.go))
      else if (t.dataset.nav === 'prev') goToSlide(cur - 1)
      else if (t.dataset.nav === 'next') goToSlide(cur + 1)
      else if (t.dataset.nav === 'play') (autoOn ? stopAuto() : startAuto())
    }
    const onEnter = () => {
      userOver = true; stopAuto(); clearTimeout(wpTimer)
      cursorG.setAttribute('opacity', '1'); tooltip.style.display = 'block'
    }
    const onLeave = () => {
      userOver = false; cursorG.setAttribute('opacity', '0'); tooltip.style.display = 'none'
      later(() => { if (!userOver && alive) { startAuto(); runWaypoints(scenario, cur) } }, 1500)
    }
    const onMove = (e: MouseEvent) => {
      const rect = vpEl.getBoundingClientRect()
      tx = (e.clientX - rect.left) / rect.width; ty = (e.clientY - rect.top) / rect.height
      cx = tx; cy = ty
      showTip('CHART', 'Hover key zones', 'Explore the levels', 'gold')
    }
    root.addEventListener('click', onClick)
    vpEl.addEventListener('mouseenter', onEnter)
    vpEl.addEventListener('mouseleave', onLeave)
    vpEl.addEventListener('mousemove', onMove)

    showDescSlide('bull', 0)
    cursorG.setAttribute('opacity', '1')
    later(() => { if (alive) { startAuto(); runWaypoints('bull', 0) } }, 800)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      clearInterval(autoTimer); clearTimeout(wpTimer)
      timers.forEach(clearTimeout)
      root.removeEventListener('click', onClick)
      vpEl.removeEventListener('mouseenter', onEnter)
      vpEl.removeEventListener('mouseleave', onLeave)
      vpEl.removeEventListener('mousemove', onMove)
    }
  }, [siteName])

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}

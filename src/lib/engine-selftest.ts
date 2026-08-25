// Dev-only self-test: parse the sample CSVs and print what the engine sees.
// Run with: node scripts/engine-test.mjs (bundled via esbuild).
import { sampleUploads, SAMPLE_BILLING } from './sample'
import { analyzeFuel } from './analyze'
import { buildInsights, buildQuestions, buildSavings } from './content'

export function runSelfTest(): void {
  const { electric, gas } = sampleUploads()
  const profile = null

  for (const p of [electric, gas]) {
    const a = analyzeFuel(p, SAMPLE_BILLING)
    console.log(`\n=== ${p.fuel} (${p.granularity}, ${p.rowCount} rows) ===`)
    console.log('range:', a.rangeLabel)
    console.log('totals:', a.totalUsage.toFixed(1), p.unit, '/', '$' + a.totalCost.toFixed(2))
    console.log('avg/day:', a.avgUsage.toFixed(2), '/', '$' + a.avgCost.toFixed(2))
    if (a.tou)
      console.log(
        'TOU:',
        a.tou.label,
        'peak $' + a.tou.peakRate.toFixed(3),
        'off $' + a.tou.offRate.toFixed(3),
        'premium', a.tou.premiumPct + '%',
        'share', Math.round(a.tou.peakCostShare * 100) + '%',
        'peak kWh/day', a.tou.peakKwhPerDay.toFixed(1),
      )
    if (a.alwaysOn)
      console.log('always-on:', a.alwaysOn.kwhPerHr.toFixed(3), 'kWh/hr ≈ $' + a.alwaysOn.monthlyCost.toFixed(0) + '/mo')
    if (a.projection)
      console.log('projection: $' + a.projection.projected.toFixed(0), `day ${a.projection.dayN} of ${a.projection.cycleDays}`)
    if (a.activeGas) console.log('active gas:', a.activeGas.days, 'of', a.activeGas.of, 'avg', a.activeGas.avgWhenOn.toFixed(2))
    if (a.sharpest) console.log('sharpest:', a.sharpest.date, a.sharpest.hour + 'h', a.sharpest.kwh.toFixed(1), 'x' + a.sharpest.ratio.toFixed(1))
    if (a.quietest) console.log('quietest:', a.quietest.date, a.quietest.belowPct + '% below')
    console.log('weekendDelta:', a.weekendDeltaPct + '%')
    console.log('events:')
    for (const e of a.events) console.log('  -', e.sev, e.type, '|', e.title, '|', e.cost, '|', e.detail)
    const sv = buildSavings(a, profile)
    console.log('savings total', sv.total, sv.items.map((s) => `${s.label} ${s.amt} ${s.w}`))
    console.log('insights:', buildInsights(a, profile).map((i) => i.title))
    console.log('questions:', buildQuestions(a, profile).map((q) => `[${q.tag}] ${q.text.slice(0, 70)} :: ${q.opts.join('/')}`))
  }
}

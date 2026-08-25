// Dev-only self-test: parse the sample CSVs and print what the engine sees.
// Run with: node scripts/engine-test.mjs (bundled via esbuild).
import { sampleUploads, SAMPLE_BILLING } from './sample'
import { analyzeFuel } from './analyze'
import { buildInsights, buildQuestions, buildSavings } from './content'
import { buildRates } from './rates'

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

export function runRatesTest(): void {
  const { electric } = sampleUploads()
  const a = analyzeFuel(electric, SAMPLE_BILLING)
  const r = buildRates(electric, a.tou, SAMPLE_BILLING)
  if (!r) {
    console.log('rates: null')
    return
  }
  console.log('\n=== rates ===')
  console.log('hasTiers', r.hasTiers)
  console.log('levels off', r.offBelow?.toFixed(4), '/', r.offAbove?.toFixed(4), ' peak', r.peakBelow?.toFixed(4), '/', r.peakAbove?.toFixed(4))
  console.log('premium below/above', r.premiumBelow?.toFixed(4), r.premiumAbove?.toFixed(4), 'tier step off/peak %', r.tierStepOffPct, r.tierStepPeakPct)
  console.log('top spend hours', r.topSpendHours.slice(0, 3), 'heaviest', r.heaviestHours.slice(0, 3))
  console.log('cheaperNeighbor', r.cheaperNeighbor)
  if (r.allowance) {
    console.log('allowance/day', r.allowance.perDayLow.toFixed(1), '-', r.allowance.perDayHigh.toFixed(1),
      'per cycle', Math.round(r.allowance.perCycleLow), '-', Math.round(r.allowance.perCycleHigh),
      'crossed day', r.allowance.crossings.map((c) => c.onDay),
      'lastCycleKwh', Math.round(r.allowance.lastCycleKwh),
      'multiple', r.allowance.multipleLow.toFixed(1), '-', r.allowance.multipleHigh.toFixed(1),
      'cycle value $' + r.allowance.cycleValue.toFixed(0))
  } else console.log('allowance: none')
  console.log('hour rows sample:', r.hours.filter((x) => [6, 15, 16, 20, 21].includes(x.h)).map((x) =>
    `${x.h}${x.peak ? 'P' : ''} below ${x.below?.toFixed(3) ?? '—'} above ${x.above?.toFixed(3) ?? '—'} eff ${x.effective?.toFixed(3)} avg ${x.avgKwh.toFixed(2)} $${x.totalCost.toFixed(0)}`))
}

// Dev-only self-test: parse the sample CSVs and print what the engine sees.
// Run with: node scripts/engine-test.mjs (bundled via esbuild).
import { sampleUploads, SAMPLE_BILLING } from './sample'
import { analyzeFuel } from './analyze'
import { buildInsights, buildQuestions, buildSavings } from './content'
import { buildRates } from './rates'
import { parseGreenButtonCsv, toGreenButtonCsv, type ParsedUpload } from './parse'
import { daysBetween, mergeUploads, reviewUpload, toRuns } from './merge'
import { addDays } from './format'

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

/** Merge + review: real assertions, since a wrong answer here loses user data. */
export function runMergeTest(): void {
  let checks = 0
  const check = (cond: unknown, msg: string) => {
    checks++
    if (!cond) throw new Error(`merge test failed: ${msg}`)
  }
  const near = (a: number, b: number, tol = 1e-5) => Math.abs(a - b) <= tol

  // Round trip: what Hearth writes must read back to the same readings.
  for (const p of [sampleUploads().electric, sampleUploads().gas]) {
    const back = parseGreenButtonCsv(
      toGreenButtonCsv({ fuel: p.fuel, unit: p.unit, granularity: p.granularity, readings: p.readings, serviceRef: p.serviceRef, sources: ['a.csv', 'b, "c".csv'] }),
      'x.csv',
    )
    check(back.readings.length === p.readings.length, `${p.fuel} round trip row count`)
    check(back.readings.every((r, i) => r.d === p.readings[i].d && r.h === p.readings[i].h), `${p.fuel} round trip keys`)
    check(back.readings.every((r, i) => near(r.usage, p.readings[i].usage) && near(r.cost, p.readings[i].cost)), `${p.fuel} round trip values`)
    check(back.readings.every((r, i) => !!r.est === !!p.readings[i].est), `${p.fuel} round trip estimated flags`)
    check(back.granularity === p.granularity && back.unit === p.unit && back.fuel === p.fuel, `${p.fuel} round trip shape`)
    check(back.serviceRef === p.serviceRef, `${p.fuel} round trip service ref`)
    check(!back.dateAmbiguous, `${p.fuel} round trip dates unambiguous`)
    check(JSON.stringify(back.sources) === JSON.stringify(['a.csv', 'b, "c".csv']), `${p.fuel} round trip sources ${JSON.stringify(back.sources)}`)
  }

  // Synthetic PG&E-style files: day d, hour h reads 1 + h/10 (+ bump).
  const synth = (o: {
    name: string
    from: string
    to: string
    daily?: boolean
    gas?: boolean
    account?: string
    skip?: [string, string]
    firstHour?: number
    lastHour?: number
    bump?: number
  }) => {
    const unit = o.gas ? 'therms' : 'kWh'
    const lines = ['Name,TEST', `Account Number,XXXXXXXX${o.account ?? '1607'}`, '']
    lines.push(o.daily ? `TYPE,DATE,USAGE (${unit}),COST,NOTES` : `TYPE,DATE,START TIME,END TIME,USAGE (${unit}),COST,NOTES`)
    for (let d = o.from; d <= o.to; d = addDays(d, 1)) {
      if (o.skip && d >= o.skip[0] && d <= o.skip[1]) continue
      if (o.daily) {
        const u = 2 + (o.bump ?? 0)
        lines.push(`Usage,${d},${u},$${(u * 0.3).toFixed(4)},`)
        continue
      }
      const h0 = d === o.from ? (o.firstHour ?? 0) : 0
      const h1 = d === o.to ? (o.lastHour ?? 23) : 23
      for (let h = h0; h <= h1; h++) {
        const u = 1 + h / 10 + (o.bump ?? 0)
        const hh = String(h).padStart(2, '0')
        lines.push(`Electric usage,${d},${hh}:00,${hh}:59,${u},$${(u * 0.3).toFixed(4)},`)
      }
    }
    return parseGreenButtonCsv(lines.join('\n'), o.name)
  }
  const at = (p: ParsedUpload, d: string, h?: number) => p.readings.find((r) => r.d === d && r.h === h)
  const runs = (rs: { start: string; end: string; days: number }[]) => rs.map((r) => `${r.start}..${r.end}:${r.days}`).join(' ')

  // The brief's overlap example: saved 07/01–08/31, new 08/20–09/20.
  const jul = synth({ name: 'jul-aug.csv', from: '2026-07-01', to: '2026-08-31' })
  const sep = synth({ name: 'aug-sep.csv', from: '2026-08-20', to: '2026-09-20', bump: 5 })
  let rv = reviewUpload(jul, sep)
  check(rv.blocked === null, 'overlap: not blocked')
  check(runs(rv.overlap) === '2026-08-20..2026-08-31:12', `overlap: runs ${runs(rv.overlap)}`)
  check(rv.gapDays === 0 && rv.fills.length === 0, 'overlap: no gaps or fills')
  check(runs(rv.added) === '2026-09-01..2026-09-20:20', `overlap: added ${runs(rv.added)}`)
  const kept = mergeUploads(jul, sep, 'keep')
  check(kept.rowCount === (62 + 20) * 24, `keep: row count ${kept.rowCount}`)
  check(near(at(kept, '2026-08-25', 12)!.usage, 2.2), 'keep: overlapping reading stays saved')
  check(near(at(kept, '2026-09-05', 12)!.usage, 7.2), 'keep: new day comes from the file')
  check(kept.periodStart === '2026-07-01' && kept.periodEnd === '2026-09-20', 'keep: span')
  check(JSON.stringify(kept.sources) === '["jul-aug.csv","aug-sep.csv"]', `keep: sources ${JSON.stringify(kept.sources)}`)
  check(kept.fileName === 'aug-sep.csv + 1 earlier file', `keep: name ${kept.fileName}`)
  check(kept.serviceRef === '1607', 'keep: service ref carried')
  const replaced = mergeUploads(jul, sep, 'replace')
  check(near(at(replaced, '2026-08-25', 12)!.usage, 7.2), 'replace: overlapping reading from the file')
  check(near(at(replaced, '2026-07-15', 12)!.usage, 2.2), 'replace: untouched days stay saved')
  check(replaced.rowCount === kept.rowCount, 'replace: same coverage as keep')
  const reread = parseGreenButtonCsv(kept.csv, kept.fileName)
  check(reread.rowCount === kept.rowCount && near(reread.totalUsage, kept.totalUsage, 1e-3), 'merged history reloads identically')

  // The brief's gap example: saved 07/01–08/01, new 08/20–09/20.
  rv = reviewUpload(synth({ name: 'a.csv', from: '2026-07-01', to: '2026-08-01' }), synth({ name: 'b.csv', from: '2026-08-20', to: '2026-09-20' }))
  check(runs(rv.gaps) === '2026-08-02..2026-08-19:18', `gap: runs ${runs(rv.gaps)}`)
  check(rv.overlapDays === 0, 'gap: no overlap')
  check(runs(rv.added) === '2026-08-20..2026-09-20:32', `gap: added ${runs(rv.added)}`)

  // A file from before the saved history leaves its gap on the other side.
  rv = reviewUpload(synth({ name: 'a.csv', from: '2026-08-10', to: '2026-08-31' }), synth({ name: 'b.csv', from: '2026-07-01', to: '2026-07-31' }))
  check(runs(rv.gaps) === '2026-08-01..2026-08-09:9', `earlier file: gap ${runs(rv.gaps)}`)

  // Hourly files meeting mid-day complete that day: no overlap, no gap.
  const am = synth({ name: 'a.csv', from: '2026-07-01', to: '2026-08-20', lastHour: 12 })
  const pm = synth({ name: 'b.csv', from: '2026-08-20', to: '2026-08-25', firstHour: 13 })
  rv = reviewUpload(am, pm)
  check(rv.overlapDays === 0 && rv.gapDays === 0, `mid-day join: overlap ${rv.overlapDays} gap ${rv.gapDays}`)
  check(mergeUploads(am, pm, 'keep').readings.filter((r) => r.d === '2026-08-20').length === 24, 'mid-day join: full day after merge')

  // A file that fills a hole in the saved history says so and flags no gap.
  rv = reviewUpload(
    synth({ name: 'a.csv', from: '2026-07-01', to: '2026-07-31', skip: ['2026-07-10', '2026-07-15'] }),
    synth({ name: 'b.csv', from: '2026-07-10', to: '2026-07-15' }),
  )
  check(runs(rv.fills) === '2026-07-10..2026-07-15:6', `fill: ${runs(rv.fills)}`)
  check(rv.gapDays === 0 && rv.overlapDays === 0 && rv.addedDays === 6, 'fill: nothing else flagged')

  // A saved hole this file does not reach is not blamed on it.
  rv = reviewUpload(
    synth({ name: 'a.csv', from: '2026-07-01', to: '2026-07-31', skip: ['2026-07-10', '2026-07-15'] }),
    synth({ name: 'b.csv', from: '2026-08-01', to: '2026-08-10' }),
  )
  check(rv.gapDays === 0 && rv.fills.length === 0, 'old hole: not repeated')

  // Entirely inside what is saved: nothing new under keep.
  rv = reviewUpload(jul, synth({ name: 'b.csv', from: '2026-07-10', to: '2026-07-20' }))
  check(rv.addedDays === 0 && rv.overlapDays === 11, `inside: added ${rv.addedDays} overlap ${rv.overlapDays}`)

  // Cannot share a history: different granularity, or a different meter.
  check(reviewUpload(jul, synth({ name: 'b.csv', from: '2026-09-01', to: '2026-09-10', daily: true })).blocked === 'granularity', 'blocked: granularity')
  check(reviewUpload(jul, synth({ name: 'b.csv', from: '2026-09-01', to: '2026-09-10', account: '9999' })).blocked === 'meter', 'blocked: meter')

  // Gas is daily: overlap by day.
  const g1 = synth({ name: 'g1.csv', from: '2026-07-01', to: '2026-07-31', daily: true, gas: true })
  const g2 = synth({ name: 'g2.csv', from: '2026-07-25', to: '2026-08-10', daily: true, gas: true, bump: 1 })
  rv = reviewUpload(g1, g2)
  check(runs(rv.overlap) === '2026-07-25..2026-07-31:7' && runs(rv.added) === '2026-08-01..2026-08-10:10', `gas: ${runs(rv.overlap)} / ${runs(rv.added)}`)
  check(mergeUploads(g1, g2, 'keep').rowCount === 41, 'gas: merged day count')

  // Three files deep: every source is remembered, through the stored CSV.
  const three = mergeUploads(parseGreenButtonCsv(kept.csv, kept.fileName), synth({ name: 'oct.csv', from: '2026-09-21', to: '2026-10-05' }), 'keep')
  check(JSON.stringify(three.sources) === '["jul-aug.csv","aug-sep.csv","oct.csv"]', `three: sources ${JSON.stringify(three.sources)}`)
  check(three.fileName === 'oct.csv + 2 earlier files', `three: name ${three.fileName}`)

  // Day arithmetic stays whole across a DST change and a month boundary.
  check(daysBetween('2026-03-07', '2026-03-09') === 2 && daysBetween('2026-10-31', '2026-11-02') === 2, 'daysBetween across DST')
  check(runs(toRuns(['2026-08-01', '2026-07-31', '2026-08-02', '2026-08-05'])) === '2026-07-31..2026-08-02:3 2026-08-05..2026-08-05:1', 'toRuns')

  console.log(`\n=== merge ===\n${checks} checks passed`)
}

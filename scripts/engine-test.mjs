// Bundles the engine self-test with esbuild and runs it.
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = join(mkdtempSync(join(tmpdir(), 'hearth-')), 'selftest.mjs')
await build({
  entryPoints: ['src/lib/engine-selftest.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
})
const mod = await import(pathToFileURL(out).href)
mod.runSelfTest()
mod.runRatesTest()

/**
 * Auditoria Lighthouse reprodutível.
 *
 * - Build otimizado servido por `vite preview` (o script sobe o servidor se não houver um na porta).
 * - Cenário padrão dos mocks (MSW ativo, como no deploy).
 * - Páginas: início e detalhe do NFT. Perfis: mobile (padrão Lighthouse) e desktop.
 * - 3 medições por combinação; reporta medianas das categorias e de LCP, CLS e TBT.
 * - Saída: lighthouse/reports/*.html|json, lighthouse/summary.json e lighthouse/summary.md.
 *
 * Uso: npm run build && npm run lighthouse
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { chromium } from '@playwright/test'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const RUNS = Number(process.env.LH_RUNS ?? 3)
const OUT = path.resolve('lighthouse')
const PAGES = [
  { id: 'inicio', path: '/' },
  { id: 'detalhe', path: '/nft/emerald-ape-042' },
]
const PROFILES = [
  { id: 'mobile', config: undefined },
  { id: 'desktop', config: desktopConfig },
]
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const METRICS = { lcp: 'largest-contentful-paint', cls: 'cumulative-layout-shift', tbt: 'total-blocking-time' }

const median = (values) => {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function isUp() {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await isUp()) return null
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' })
  for (let i = 0; i < 60; i += 1) {
    if (await isUp()) return child
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('vite preview não respondeu')
}

async function main() {
  await mkdir(path.join(OUT, 'reports'), { recursive: true })
  const server = await ensureServer()
  // Chromium do Playwright: versão fixa e reproduzível entre máquinas.
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-first-run', '--disable-extensions'],
  })
  const results = []
  let lhVersion = ''
  let chromeVersion = ''
  try {
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const runs = []
        for (let run = 1; run <= RUNS; run += 1) {
          const { lhr, report } = await lighthouse(
            `${BASE}${page.path}`,
            { port: chrome.port, output: ['html', 'json'], logLevel: 'error', disableStorageReset: false },
            profile.config,
          )
          lhVersion = lhr.lighthouseVersion
          chromeVersion = lhr.environment?.hostUserAgent ?? ''
          const base = `${page.id}-${profile.id}-${run}`
          await writeFile(path.join(OUT, 'reports', `${base}.html`), report[0])
          await writeFile(path.join(OUT, 'reports', `${base}.json`), report[1])
          const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]))
          const metrics = Object.fromEntries(Object.entries(METRICS).map(([k, id]) => [k, lhr.audits[id]?.numericValue ?? null]))
          runs.push({ run, scores, metrics })
          console.log(`${page.id} ${profile.id} #${run}`, scores, metrics)
        }
        results.push({
          page: page.id,
          url: page.path,
          profile: profile.id,
          runs,
          median: {
            ...Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
            lcpMs: Math.round(median(runs.map((r) => r.metrics.lcp))),
            cls: Number(median(runs.map((r) => r.metrics.cls)).toFixed(3)),
            tbtMs: Math.round(median(runs.map((r) => r.metrics.tbt))),
          },
        })
      }
    }
  } finally {
    await chrome.kill()
    server?.kill()
  }

  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  const environment = {
    date: new Date().toISOString(),
    lighthouse: lhVersion,
    browser: chromeVersion,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model ?? 'desconhecida',
    cores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    runsPerCombination: RUNS,
    build: 'vite build (produção) servido por vite preview',
    mocks: 'MSW ativo, cenário "default" (latência determinística 120–380 ms)',
    throttling: 'padrões do Lighthouse: mobile = Moto G Power + 4G lento simulado; desktop = preset desktop',
    app: `${pkg.name}@${pkg.version}`,
  }
  await writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ environment, results }, null, 2))

  const goal = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
  const mark = (c, v) => (v >= goal[c] ? `${v}` : `**${v}** ⚠️`)
  const lines = [
    '# Lighthouse — medianas',
    '',
    `Gerado em ${environment.date} · Lighthouse ${environment.lighthouse} · ${environment.runsPerCombination} medições por combinação.`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...results.map(
      (r) =>
        `| ${r.page} | ${r.profile} | ${mark('performance', r.median.performance)} | ${mark('accessibility', r.median.accessibility)} | ${mark('best-practices', r.median['best-practices'])} | ${mark('seo', r.median.seo)} | ${r.median.lcpMs} | ${r.median.cls} | ${r.median.tbtMs} |`,
    ),
    '',
    'Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. ⚠️ = abaixo da meta (análise em ARCHITECTURE.md).',
    '',
    '## Ambiente',
    '',
    ...Object.entries(environment).map(([k, v]) => `- **${k}**: ${v}`),
    '',
  ]
  await writeFile(path.join(OUT, 'summary.md'), lines.join('\n'))
  console.log('\nResumo em lighthouse/summary.md')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

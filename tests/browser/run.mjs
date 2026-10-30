// Real-browser smoke test: serves the app locally, boots it in headless Chromium, runs the Omni command language against the live scene and checks the result.
// Needs: npm install && npm run vendor (in this folder) and a Chromium that playwright-core can find (PLAYWRIGHT_BROWSERS_PATH or `npx playwright-core install chromium`).
// Env: OMNI_APP_DIR (default ../..), OMNI_HEADLESS_GL (default swiftshader: works without a GPU).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = (() => { for (const n of ['playwright', 'playwright-core']) { try { return require(n) } catch (_) { /* try the next */ } } throw new Error('install playwright or playwright-core (npm install in tests/browser)') })()
const APP = path.resolve(process.env.OMNI_APP_DIR || path.join(HERE, '..', '..'))
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.md': 'text/markdown', '.pdf': 'application/pdf' }
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(APP, p); if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end('nf') } r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r) })
await new Promise(r => srv.listen(0, r)); const port = srv.address().port
const nm = (p) => path.join(HERE, 'node_modules', p); const vd = (p) => path.join(HERE, '.vendor', p)
const MAP = [[/three@0\.165\.0\/build\/three\.module\.js/, nm('three/build/three.module.js')], [/three@0\.165\.0\/examples\/jsm\/(.*)$/, (m) => nm('three/examples/jsm/' + m[1])], [/gsap@3\.12\.5\/index\.js/, vd('gsap.js')], [/d3@7\.9\.0/, vd('d3.js')], [/d3-sankey@0\.12\.3/, vd('d3-sankey.js')], [/jszip@3\.10\.1\/dist\/jszip\.min\.js/, nm('jszip/dist/jszip.min.js')]]
const b = await chromium.launch({ args: [`--use-gl=${process.env.OMNI_HEADLESS_GL || 'swiftshader'}`, '--enable-unsafe-swiftshader', '--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true }); const pg = await ctx.newPage()
const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console.error ' + m.text().slice(0, 200)) })
await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { const u = route.request().url(); for (const [re, t] of MAP) { const m = re.exec(u); if (m) { const f = typeof t === 'function' ? t(m) : t; if (fs.existsSync(f)) return route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }) } } route.abort() })
await pg.goto(`http://127.0.0.1:${port}/index.html`)
let code = 1
try { const steps = (await import('./smoke.mjs')).default; const res = await steps(pg, errs); code = res.failed ? 1 : 0; console.log(res.report) } catch (e) { console.log('HARNESS ERROR', e.stack || e.message) }
await b.close(); srv.close(); process.exit(code)

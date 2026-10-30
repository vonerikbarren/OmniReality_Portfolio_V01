// The app imports three / gsap / d3 / jszip from a CDN (see index.html's import map). The tests serve local copies instead, so they run offline and on a pinned version.
// This bundles gsap, d3 and d3-sankey into .vendor/ with esbuild (three and jszip are used straight from node_modules).
import { build } from 'esbuild'
import fs from 'node:fs'
fs.mkdirSync('.vendor', { recursive: true })
const one = (name, entry, global) => build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, format: 'esm', outfile: `.vendor/${name}.js`, logLevel: 'error' })
await one('gsap', "import gsap from 'gsap'; export { gsap }; export default gsap")
await one('d3', "export * from 'd3'")
await one('d3-sankey', "export * from 'd3-sankey'")
console.log('vendor ready')

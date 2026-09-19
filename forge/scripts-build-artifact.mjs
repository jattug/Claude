/**
 * Reshape the Vite build for publishing as an Artifact.
 *
 * The artifact platform wraps the published file in its own document skeleton,
 * so the page must not carry its own doctype/html/head/body. This extracts the
 * title, stylesheet and script references from the build and emits a
 * content-level page that references the same asset files, which are published
 * alongside it.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const html = readFileSync('dist/index.html', 'utf8')
const js = html.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1]
const css = html.match(/href="\.\/(assets\/[^"]+\.css)"/)?.[1]
if (!js || !css) throw new Error('Could not find the built asset references in dist/index.html')

mkdirSync('artifact/assets', { recursive: true })
for (const f of readdirSync('dist/assets')) {
  copyFileSync(join('dist/assets', f), join('artifact/assets', f))
}

// The page keeps its own dark/light handling: styles.css defines the full light
// palette on :root and redefines it under both prefers-color-scheme and
// [data-theme="dark"], so all three viewer theme states resolve correctly.
writeFileSync('artifact/index.html', `<title>Forge Trading Journal</title>
<link rel="stylesheet" href="${css}">
<div id="root"></div>
<script type="module" src="${js}"></script>
`)

console.log(`artifact/index.html -> ${css}, ${js}`)

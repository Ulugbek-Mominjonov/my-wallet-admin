import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Plugin } from 'vite'

const INLINE_SCRIPT_RE = /<script>([\s\S]*?)<\/script>/g
const PLACEHOLDER = '%INLINE_SCRIPT_HASHES%'

/**
 * Build tugagach `dist/index.html` dagi inline skriptlar (tema skripti)
 * sha256 hash'ini hisoblab, CSP bilan `dist/_headers` ni yozadi.
 * Hash qo'lda yozilmaydi — skript o'zgarsa CSP avtomatik moslashadi.
 */
export function cspHeadersPlugin(templatePath: string): Plugin {
  let outDir = 'dist'
  return {
    name: 'my-wallet:csp-headers',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async writeBundle() {
      const html = await readFile(join(outDir, 'index.html'), 'utf8')
      const hashes = [...html.matchAll(INLINE_SCRIPT_RE)].map(([, body = '']) => {
        const digest = createHash('sha256').update(body).digest('base64')
        return `'sha256-${digest}'`
      })
      const template = await readFile(templatePath, 'utf8')
      if (!template.includes(PLACEHOLDER)) {
        throw new Error(`${templatePath} da ${PLACEHOLDER} yo'q`)
      }
      await writeFile(join(outDir, '_headers'), template.replace(PLACEHOLDER, hashes.join(' ')))
    },
  }
}

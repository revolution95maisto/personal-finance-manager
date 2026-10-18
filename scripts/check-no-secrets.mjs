// Verifica che nel codice del frontend (src, dist, index.html) non ci siano chiavi segrete Supabase.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const problems = []

function scan(file) {
  const text = readFileSync(file, 'utf8')
  if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(text)) {
    problems.push(`${file}: contiene una chiave segreta Supabase (sb_secret_...)`)
  }
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const role = JSON.parse(Buffer.from(m[1], 'base64url').toString()).role
      if (role === 'service_role') problems.push(`${file}: contiene una chiave service_role`)
    } catch {
      /* non è un JWT */
    }
  }
}

function walk(path) {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name))
  } else {
    scan(path)
  }
}

for (const root of ['src', 'dist', 'index.html']) if (existsSync(root)) walk(root)

if (problems.length) {
  console.error('ERRORE: trovate possibili chiavi segrete nel frontend:\n' + problems.join('\n'))
  process.exit(1)
}
console.log('OK: nessuna chiave segreta trovata nel frontend.')

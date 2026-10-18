// Controlli sui file della PWA e sul service worker (eseguito in un contesto isolato).
import { existsSync, readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

const root = new URL('../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

const manifest = JSON.parse(read('public/manifest.webmanifest')) as {
  name: string
  start_url: string
  scope: string
  display: string
  lang: string
  icons: { src: string; sizes: string; purpose: string }[]
}

function pngSize(path: string): [number, number] {
  const buf = readFileSync(new URL(path, root))
  expect(buf.subarray(1, 4).toString()).toBe('PNG')
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

describe('manifest', () => {
  it('ha i campi richiesti per l\'installazione', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(manifest.lang).toBe('it')
    // percorsi relativi: funziona anche in una sottocartella (GitHub Pages)
    expect(manifest.start_url).toBe('./')
    expect(manifest.scope).toBe('./')
  })

  it('ha icone 192 e 512 e una maskable, con le dimensioni dichiarate', () => {
    const sizes = manifest.icons.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) {
      expect(existsSync(new URL(`public/${icon.src}`, root))).toBe(true)
      const [w, h] = pngSize(`public/${icon.src}`)
      expect(`${w}x${h}`).toBe(icon.sizes)
    }
  })
})

describe('index.html e configurazione', () => {
  const html = read('index.html')
  it('collega manifest, icona iOS e viewport', () => {
    expect(html).toMatch(/rel="manifest" href="manifest\.webmanifest"/)
    expect(html).toMatch(/rel="apple-touch-icon"/)
    expect(html).toMatch(/viewport-fit=cover/)
    expect(existsSync(new URL('public/icons/apple-touch-icon.png', root))).toBe(true)
  })
  it('usa percorsi relativi per la pubblicazione ovunque', () => {
    expect(read('vite.config.ts')).toMatch(/base: '\.\/'/)
  })
})

describe('service worker', () => {
  const code = read('public/sw.js')

  function load() {
    const handlers: Record<string, (e: unknown) => void> = {}
    const self = {
      location: { origin: 'https://app.example' },
      addEventListener: (type: string, fn: (e: unknown) => void) => {
        handlers[type] = fn
      },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    }
    const caches = {
      match: () => Promise.resolve(undefined),
      open: () => Promise.resolve({ put: () => Promise.resolve(), addAll: () => Promise.resolve() }),
      keys: () => Promise.resolve([]),
      delete: () => Promise.resolve(true),
    }
    const fetch = () => Promise.resolve({ ok: true, clone: () => ({}) })
    vm.runInNewContext(code, { self, caches, fetch, URL, Promise })
    return handlers
  }

  function run(method: string, url: string, mode = 'cors') {
    let responded = false
    load().fetch({
      request: { method, url, mode },
      respondWith: () => {
        responded = true
      },
    })
    return responded
  }

  it('non intercetta le richieste ad altre origini (Supabase) né le non-GET', () => {
    expect(run('GET', 'https://abcdefghij.supabase.co/rest/v1/transactions')).toBe(false)
    expect(run('GET', 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans')).toBe(false)
    expect(run('POST', 'https://app.example/qualsiasi')).toBe(false)
    expect(run('DELETE', 'https://app.example/qualsiasi')).toBe(false)
  })

  it('gestisce solo pagina e file della stessa origine', () => {
    expect(run('GET', 'https://app.example/', 'navigate')).toBe(true)
    expect(run('GET', 'https://app.example/assets/index-abc123.js')).toBe(true)
  })

  it('non contiene riferimenti a Supabase o a dati dell\'utente', () => {
    expect(code).not.toMatch(/supabase|auth|token/i)
  })
})

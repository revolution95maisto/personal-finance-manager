import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from './errors'

const REFRESH_AFTER_MS = 10_000

/**
 * Carica dati e li tiene aggiornati: si ricarica da solo quando cambiano `deps`
 * e quando l'app torna in primo piano (così telefono e PC restano allineati).
 * Durante i ricaricamenti `data` resta quello precedente: niente lampeggi.
 */
export function useResource<T>(loader: () => Promise<T>, deps: readonly unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const lastLoad = useRef(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    loader()
      .then((value) => {
        if (!alive) return
        lastLoad.current = Date.now()
        setData(value)
        setError(null)
      })
      .catch((e: Error) => {
        if (alive) setError(friendlyError(e.message))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REFRESH_AFTER_MS) {
        setTick((t) => t + 1)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

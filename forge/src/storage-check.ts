/**
 * Storage availability.
 *
 * The whole journal lives in IndexedDB. A private window, blocked site data or
 * a locked-down browser can make it unavailable or make it throw on open — and
 * the worst failure mode is a page that sits on "Loading…" forever without
 * saying why. This checks up front so the app can explain itself instead.
 */
export async function indexedDbAvailable(): Promise<true | string> {
  if (typeof indexedDB === 'undefined' || indexedDB === null) {
    return 'This browser does not expose IndexedDB, which is where Forge keeps your journal.'
  }
  try {
    const probe = indexedDB.open('forge-storage-probe')
    const ok = await new Promise<boolean>((resolve) => {
      probe.onsuccess = () => {
        probe.result.close()
        try { indexedDB.deleteDatabase('forge-storage-probe') } catch { /* best effort */ }
        resolve(true)
      }
      probe.onerror = () => resolve(false)
      probe.onblocked = () => resolve(true)
      setTimeout(() => resolve(false), 4000)
    })
    return ok
      ? true
      : 'This browser refused to open local storage. Private or incognito windows usually block it.'
  } catch (e) {
    return `Local storage could not be opened: ${(e as Error).message}`
  }
}

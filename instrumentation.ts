// Capte les erreurs serveur et les envoie aux administrateurs (voir lib/bugs.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { reportBug } = await import('@/lib/bugs')
  const original = console.error
  // Les erreurs déjà gérées par le code (journalisées sous la forme « [module] message ») sont aussi transmises.
  console.error = (...args: unknown[]) => {
    original(...args)
    const first = args[0]
    if (typeof first !== 'string' || !/^\[[\wé-]+\]/i.test(first) || /^\[(notify|audit|alert|bug)\]/i.test(first)) return
    const err = args.find((a) => a instanceof Error) ?? (args.slice(1).map(String).join(' ') || first)
    void reportBug('Serveur', err, first)
  }
}

export async function onRequestError(error: unknown, request: { path: string; method: string }) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { reportBug } = await import('@/lib/bugs')
  await reportBug(`${request.method} ${request.path}`, error)
}

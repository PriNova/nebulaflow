const MODEL_REFRESH_TIMEOUT_MS = 15_000

async function createPiModelRuntime() {
    const { ModelRuntime } = await import('@earendil-works/pi-coding-agent')
    return ModelRuntime.create({ allowModelNetwork: false })
}

type PiModelRuntime = Awaited<ReturnType<typeof createPiModelRuntime>>

let modelRuntimePromise: Promise<PiModelRuntime> | undefined
let modelRefreshPromise: Promise<void> | undefined

/**
 * Return the process-wide pi model runtime.
 *
 * Initial creation is cache-first so model selection and execution do not wait
 * for provider catalog network requests. Authentication and custom models use
 * pi's standard ~/.pi/agent/auth.json and ~/.pi/agent/models.json stores.
 */
export async function getPiModelRuntime(): Promise<PiModelRuntime> {
    modelRuntimePromise ??= createPiModelRuntime()
    const runtime = await modelRuntimePromise
    startPiModelRefresh(runtime)
    return runtime
}

function startPiModelRefresh(runtime: PiModelRuntime): void {
    if (process.env.PI_OFFLINE !== undefined || modelRefreshPromise) return

    modelRefreshPromise = refreshPiModels(runtime).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        // eslint-disable-next-line no-console -- catalog refresh failures are host diagnostics
        console.warn(`[nebulaflow] pi model catalog refresh failed: ${message}`)
    })
}

async function refreshPiModels(runtime: PiModelRuntime): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), MODEL_REFRESH_TIMEOUT_MS)

    try {
        const result = await runtime.refresh({
            allowNetwork: true,
            force: true,
            signal: controller.signal,
        })

        if (result.aborted) {
            // eslint-disable-next-line no-console -- cached-catalog fallback should be visible to hosts
            console.warn('[nebulaflow] pi model catalog refresh timed out; cached models remain active')
        }
        for (const [provider, error] of result.errors) {
            const message = error instanceof Error ? error.message : String(error)
            // eslint-disable-next-line no-console -- provider refresh failures are host diagnostics
            console.warn(`[nebulaflow] pi model catalog refresh failed for ${provider}: ${message}`)
        }
    } finally {
        clearTimeout(timeout)
    }
}

export interface GenericVSCodeWrapper<W, E> {
    postMessage: (message: W) => void
    onMessage: (callback: (event: MessageEvent<E>) => void) => () => void
    getState: () => unknown
    setState: (newState: unknown) => void
}

declare const acquireVsCodeApi: () => {
    postMessage: (message: unknown) => void
    getState: () => unknown
    setState: (newState: unknown) => void
}

let api: GenericVSCodeWrapper<any, any> | undefined

export function getGenericVSCodeAPI<W, E>(): GenericVSCodeWrapper<W, E> {
    if (!api) {
        const vsCodeApi = acquireVsCodeApi()
        api = {
            postMessage: (message: W) => {
                try {
                    // Any non-structured-clone-safe payload will throw here (e.g., functions)
                    // Keep this tight and observable for debugging regressions.
                    vsCodeApi.postMessage(message)
                } catch (err: any) {
                    const type = (message as any)?.type
                    console.error('VSCode postMessage failed', {
                        error: err?.message || String(err),
                        type,
                    })
                    throw err
                }
            },
            onMessage: (callback: (event: MessageEvent<E>) => void) => {
                const listener = (event: MessageEvent<E>): void => callback(event)
                window.addEventListener('message', listener)
                return () => window.removeEventListener('message', listener)
            },
            getState: () => vsCodeApi.getState(),
            setState: newState => vsCodeApi.setState(newState),
        }
    }
    return api as GenericVSCodeWrapper<W, E>
}

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

interface NebulaPort {
    onDidReceiveMessage: (cb: (msg: unknown) => void) => { dispose: () => void }
}

let api: GenericVSCodeWrapper<unknown, unknown> | undefined

export function getGenericVSCodeAPI<W, E>(): GenericVSCodeWrapper<W, E> {
    if (!api) {
        const vsCodeApi = acquireVsCodeApi()

        // Web target: messages flow through the WebSocket port (window.__nebulaPort).
        // VS Code target: messages come as window 'message' events from the extension host.
        const nebulaPort = (window as { __nebulaPort?: NebulaPort }).__nebulaPort

        api = {
            postMessage: (message: unknown) => {
                try {
                    // Any non-structured-clone-safe payload will throw here (e.g., functions)
                    // Keep this tight and observable for debugging regressions.
                    vsCodeApi.postMessage(message)
                } catch (err: unknown) {
                    const typedErr = err instanceof Error ? err : new Error(String(err))
                    const msgWithType = message as { type?: string }
                    console.error('VSCode postMessage failed', {
                        error: typedErr.message,
                        type: msgWithType.type,
                    })
                    throw err
                }
            },
            onMessage: (callback: (event: MessageEvent<E>) => void) => {
                if (nebulaPort) {
                    // Web target: messages arrive via WebSocket, not window.postMessage.
                    // Wrap raw message data in a MessageEvent-like shape so callers
                    // (useMessageHandler, etc.) can access event.data as they do in VS Code.
                    const disposable = nebulaPort.onDidReceiveMessage((msg: unknown) => {
                        callback({ data: msg } as MessageEvent<E>)
                    })
                    return () => disposable.dispose()
                }
                // VS Code target: messages arrive as window 'message' events.
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

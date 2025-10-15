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
            postMessage: (message: W) => vsCodeApi.postMessage(message),
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

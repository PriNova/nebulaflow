import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('acquireVsCodeApi', () => {
    return {
        postMessage: (message: any) => ipcRenderer.send('webview-message', message),
        getState: () => undefined,
        setState: () => undefined,
    }
})

ipcRenderer.on('webview-message', (_event, message) => {
    window.postMessage(message, '*')
})

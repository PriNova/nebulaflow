/**
 * Web target bootstrap.
 *
 * 1. Creates a WebSocketMessagePort connected to the bridge server.
 * 2. Wires it to the acquireVsCodeApi shim on window.
 * 3. Mounts the React Flow UI (same WorkflowApp as the VS Code webview).
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkflowApp } from '../workflow/Web/WorkflowApp.js'
import { getGenericVSCodeAPI } from '../workflow/Web/utils/vscode.js'
import { WebSocketMessagePort } from './WebSocketMessagePort.js'

import '../workflow/Web/index.css'

async function main() {
    const port = new WebSocketMessagePort('ws://localhost:8148')
    await port.connect()

    // Expose for the acquireVsCodeApi shim in index.html
    ;(window as any).__nebulaPort = port

    const rootEl = document.getElementById('root')
    if (!rootEl) throw new Error('Missing #root element')

    ReactDOM.createRoot(rootEl).render(
        <React.StrictMode>
            <ReactFlowProvider>
                <WorkflowApp vscodeAPI={getGenericVSCodeAPI()} />
            </ReactFlowProvider>
        </React.StrictMode>
    )
}

main().catch(err => {
    document.getElementById('root')!.textContent =
        'Failed to start NebulaFlow: ' +
        (err instanceof Error ? err.message : String(err))
})

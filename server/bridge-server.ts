import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { setupWorkflowMessageHandling } from '../workflow/Application/workflow-session.js'
import { initializeHost } from '../workflow/DataAccess/fs.js'
import { initializeWorkspace } from '../workflow/Shared/Infrastructure/workspace.js'
import { NodeHost } from './NodeHost.js'
import { WebSocketPort } from './WebSocketPort.js'

const PORT = Number(process.env.NEBULAFLOW_WEB_PORT ?? 8148)

const host = new NodeHost()
initializeHost(host)
initializeWorkspace(host)

const http = createServer()
const wss = new WebSocketServer({ server: http })

wss.on('connection', ws => {
    const port = new WebSocketPort(ws)
    host.setPort(port)

    setupWorkflowMessageHandling(host, port, true, _uri => {
        // Title updates are handled by the browser setting document.title
    })

    ws.on('close', () => {
        host.setPort(null as unknown as IMessagePort) // detach — next connection will re-set
    })
})

http.listen(PORT, () => {
    console.log(`[nebulaflow-web] bridge server on ws://localhost:${PORT}`)
})

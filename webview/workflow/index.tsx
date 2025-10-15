import React from 'react'
import ReactDOM from 'react-dom/client'

import '../index.css'
import { ReactFlowProvider } from '@xyflow/react'
import { getGenericVSCodeAPI } from '../utils/vscode'
import { WorkflowApp } from './WorkflowApp'

ReactDOM.createRoot(document.querySelector('#root') as HTMLElement).render(
    <React.StrictMode>
        <ReactFlowProvider>
            <WorkflowApp vscodeAPI={getGenericVSCodeAPI()} />
        </ReactFlowProvider>
    </React.StrictMode>
)

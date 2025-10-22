import * as vscode from 'vscode'
import {
    activate as workflowActivate,
    deactivate as workflowDeactivate,
} from '../workflow/Application/register'

export function activate(context: vscode.ExtensionContext): void {
    if (context.extensionMode === vscode.ExtensionMode.Development) {
        console.log('[NebulaFlow] Activated in Development mode')
    }
    workflowActivate(context)
}

export function deactivate(): void {
    workflowDeactivate()
}

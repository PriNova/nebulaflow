import type * as vscode from 'vscode'
import {
    activate as workflowActivate,
    deactivate as workflowDeactivate,
} from '../workflow/Application/register'

export function activate(context: vscode.ExtensionContext): void {
    workflowActivate(context)
}

export function deactivate(): void {
    workflowDeactivate()
}

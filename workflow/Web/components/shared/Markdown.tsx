import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import { useEffect, useMemo, useRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { ExtensionToWorkflow, WorkflowToExtension } from '../../services/Protocol'
import { getGenericVSCodeAPI } from '../../utils/vscode'

function preEscapeDangerousTags(input: string): string {
    // Pre-escape <script> and <style> tags so the HTML parser never treats them as actual tags
    return input.replace(/<(?:\/?)(script|style)(?=\s|>|$)/gi, m => m.replace('<', '&lt;'))
}

const markedInstance = new Marked(
    markedHighlight({
        emptyLangClass: 'hljs',
        langPrefix: 'hljs language-',
        highlight(code: string, lang: string) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext'
            return hljs.highlight(code, { language }).value
        },
    })
)

export function Markdown({
    content,
    className,
    ...rest
}: { content: string; className?: string } & HTMLAttributes<HTMLDivElement>) {
    const vscodeAPI = getGenericVSCodeAPI<WorkflowToExtension, ExtensionToWorkflow>()
    const containerRef = useRef<HTMLDivElement | null>(null)

    const html = useMemo(() => {
        const parsed = preEscapeDangerousTags(content ?? '')
        const raw = markedInstance.parse(parsed, { async: false, gfm: true, breaks: true }) as string
        const safe = DOMPurify.sanitize(raw, {
            ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|file|vscode(?:-[\w]+)*):/,
            FORBID_TAGS: ['script', 'object', 'embed', 'form', 'style', 'svg', 'button'],
            ALLOWED_ATTR: [
                'src',
                'href',
                'class',
                'srcset',
                'alt',
                'title',
                'width',
                'height',
                'loading',
                'name',
                'target',
                'rel',
            ],
        })
        return safe
    }, [content])

    // biome-ignore lint/correctness/useExhaustiveDependencies: rebind anchors when content changes
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const anchors = Array.from(el.querySelectorAll('a')) as HTMLAnchorElement[]
        const onClick = (e: MouseEvent) => {
            const target = e.currentTarget as HTMLAnchorElement
            const href = target.getAttribute('href')
            if (!href) return
            // Open via extension so VS Code handles file:// and external links
            e.preventDefault()
            vscodeAPI.postMessage({ type: 'open_external_link', url: href } as any)
        }
        for (const a of anchors) a.addEventListener('click', onClick)
        return () => {
            for (const a of anchors) a.removeEventListener('click', onClick)
        }
    }, [content, vscodeAPI])

    return (
        <div
            ref={containerRef}
            className={['markdown', className].filter(Boolean).join(' ')}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: content sanitized via DOMPurify
            dangerouslySetInnerHTML={{ __html: html }}
            {...rest}
        />
    )
}

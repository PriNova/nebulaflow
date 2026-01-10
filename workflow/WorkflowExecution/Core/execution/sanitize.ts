export type ShellType = 'bash' | 'sh' | 'zsh' | 'pwsh' | 'cmd'

/**
 * Escapes a string value for safe interpolation into a shell command/script.
 * The escaped value will be treated as a literal string, preventing injection.
 */
export function escapeForShell(input: string, shell: ShellType): string {
    const cleaned = input.replace(/\0/g, '') // Strip null bytes

    switch (shell) {
        case 'bash':
        case 'sh':
        case 'zsh':
            return escapeForPosix(cleaned)
        case 'pwsh':
            return escapeForPowerShell(cleaned)
        case 'cmd':
            return escapeForCmd(cleaned)
        default:
            return escapeForPosix(cleaned)
    }
}

function escapeForPosix(input: string): string {
    // Wrap in single quotes, escape embedded single quotes as: '\''
    return "'" + input.replace(/'/g, "'\\''") + "'"
}

function escapeForPowerShell(input: string): string {
    // Double single quotes inside single-quoted string
    return "'" + input.replace(/'/g, "''") + "'"
}

function escapeForCmd(input: string): string {
    // Escape % and ", wrap in double quotes
    return '"' + input.replace(/%/g, '%%').replace(/"/g, '""') + '"'
}

/**
 * Escapes a string value for safe interpolation into a shell command/script.
 * The escaped value will be treated as a literal string, preventing injection.
 */
export function sanitizeForShell(input: string): string {
    let sanitized = input.replace(/\\/g, '\\\\')
    sanitized = sanitized.replace(/\${/g, '\\${')
    sanitized = sanitized.replace(/\"/g, '\\"')
    for (const char of ["'", ';']) {
        sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`)
    }
    return sanitized
}

export const commandsNotAllowed = [
    'rm',
    'chmod',
    'shutdown',
    'history',
    'user',
    'sudo',
    'su',
    'passwd',
    'chown',
    'chgrp',
    'kill',
    'reboot',
    'poweroff',
    'init',
    'systemctl',
    'journalctl',
    'dmesg',
    'lsblk',
    'lsmod',
    'modprobe',
    'insmod',
    'rmmod',
    'lsusb',
    'lspci',
]

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

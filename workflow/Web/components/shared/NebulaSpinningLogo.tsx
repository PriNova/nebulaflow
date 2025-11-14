import type React from 'react'
import nebulaMark from '../../assets/nebula-mark.svg'

export interface NebulaSpinningLogoProps {
    width: number
    height: number
    scale?: number // portion of min(width,height), default 0.6
    opacity?: number // 0..1, default 0.10
    axis?: 'x' | 'y' | 'z'
    className?: string
    style?: React.CSSProperties
}

export const NebulaSpinningLogo: React.FC<NebulaSpinningLogoProps> = ({
    width,
    height,
    scale = 2.5,
    opacity = 0.1,
    axis = 'z',
    className,
    style,
}) => {
    const size = Math.max(0, Math.floor(Math.min(width, height) * scale))
    return (
        <div
            className={className}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
        >
            <div
                className="tw-absolute tw-top-1/2 tw-left-1/2 perspective-800"
                style={{ transform: 'translate(-50%, -50%)' }}
            >
                <img
                    src={nebulaMark}
                    alt="NebulaFlow"
                    className={axis === 'x' ? 'spin-x' : axis === 'y' ? 'spin-y' : 'tw-animate-spin'}
                    style={{
                        width: size,
                        height: size,
                        animationDuration: '24s',
                        opacity,
                        filter: 'drop-shadow(0 0 12px rgba(0,0,0,0.15))',
                        userSelect: 'none',
                    }}
                />
            </div>
        </div>
    )
}

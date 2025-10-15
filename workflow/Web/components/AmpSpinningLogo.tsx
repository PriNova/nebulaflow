import type React from 'react'
import ampMark from '../assets/amp-mark.svg'

export interface AmpSpinningLogoProps {
    width: number
    height: number
    scale?: number // portion of min(width,height), default 0.6
    opacity?: number // 0..1, default 0.10
    axis?: 'x' | 'y' | 'z'
    className?: string
    style?: React.CSSProperties
}

export const AmpSpinningLogo: React.FC<AmpSpinningLogoProps> = ({
    width,
    height,
    scale = 0.6,
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
                    src={ampMark}
                    alt="Amp"
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

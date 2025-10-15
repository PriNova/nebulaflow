import type React from 'react'

interface SliderProps {
    value?: number[]
    onValueChange?: (value: number[]) => void
    min?: number
    max?: number
    step?: number
    className?: string
}

export const Slider: React.FC<SliderProps> = ({
    value = [0],
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    className,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number.parseFloat(e.target.value)
        onValueChange?.([newValue])
    }

    return (
        <input
            type="range"
            value={value[0]}
            onChange={handleChange}
            min={min}
            max={max}
            step={step}
            className={className}
        />
    )
}

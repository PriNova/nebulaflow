import type React from 'react'

interface SliderProps {
    id?: string
    value?: number[]
    onValueChange?: (value: number[]) => void
    min?: number
    max?: number
    step?: number
    className?: string
}

export const Slider: React.FC<SliderProps> = ({
    id,
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
            id={id}
            value={value[0]}
            onChange={handleChange}
            min={min}
            max={max}
            step={step}
            className={className}
        />
    )
}

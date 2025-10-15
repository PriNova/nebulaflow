import type { PopoverContentProps, PopoverProps } from '@radix-ui/react-popover'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { ChevronDownIcon } from 'lucide-react'
import type React from 'react'
import {
    type ButtonHTMLAttributes,
    type ComponentType,
    type FunctionComponent,
    type KeyboardEventHandler,
    type PropsWithChildren,
    type ReactNode,
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import { cn } from '../utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import styles from './toolbar.module.css'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

const buttonVariants = cva('tw-border-none tw-flex tw-items-center focus-visible:tw-outline-none', {
    variants: { variant: { primary: '', secondary: '' } },
    defaultVariants: { variant: 'secondary' },
})

type IconComponent = ComponentType<{ width?: number | string; height?: number | string }>

interface ToolbarButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    tooltip?: ReactNode
    iconStart?: IconComponent
    iconEnd?: IconComponent | 'chevron' | null
    asChild?: boolean
}

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
    (
        {
            className,
            variant,
            asChild = false,
            tooltip,
            iconStart: IconStart,
            iconEnd: IconEnd,
            children,
            ...props
        },
        ref
    ) => {
        const Comp = asChild ? Slot : 'button'
        const button = (
            <Comp
                className={cn(buttonVariants({ variant, className }), styles.button, {
                    [styles.buttonPrimary]: variant === 'primary',
                    [styles.buttonSecondary]: variant === 'secondary',
                    [styles.buttonNoIconStart]: children && !IconStart,
                    [styles.buttonNoIconEnd]: children && !IconEnd,
                })}
                ref={ref}
                {...props}
            >
                {IconStart && <IconStart />}
                {children}
                {IconEnd && (IconEnd === 'chevron' ? <ChevronDownIcon /> : <IconEnd />)}
            </Comp>
        )
        return tooltip ? (
            <Tooltip>
                <TooltipTrigger asChild={true}>{button}</TooltipTrigger>
                <TooltipContent side="bottom">{tooltip}</TooltipContent>
            </Tooltip>
        ) : (
            button
        )
    }
)
ToolbarButton.displayName = 'ToolbarButton'

interface PopoverControlMethods {
    open: () => void
    close: () => void
}
interface MutableRefObject<T> {
    current: T
}

export const ToolbarPopoverItem: FunctionComponent<
    PropsWithChildren<
        ButtonHTMLAttributes<HTMLButtonElement> &
            Pick<ToolbarButtonProps, 'iconStart' | 'tooltip'> & {
                iconEnd: ToolbarButtonProps['iconEnd'] | null
                popoverContent: (close: () => void) => React.ReactNode
                defaultOpen?: boolean
                onCloseByEscape?: () => void
                popoverRootProps?: Pick<PopoverProps, 'onOpenChange'>
                popoverContentProps?: Omit<PopoverContentProps, 'align'>
                __storybook__open?: boolean
                controlRef?: MutableRefObject<PopoverControlMethods | null>
            }
    >
> = ({
    iconEnd = 'chevron',
    iconStart,
    tooltip,
    popoverContent,
    defaultOpen,
    onCloseByEscape,
    popoverRootProps,
    popoverContentProps,
    __storybook__open,
    children,
    controlRef,
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const onButtonClick = useCallback(() => {
        setIsOpen(isOpen => !isOpen)
    }, [])
    const anchorRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        if (__storybook__open) {
            setIsOpen(true)
        }
    }, [__storybook__open])

    useImperativeHandle(
        controlRef,
        () => ({ open: () => setIsOpen(true), close: () => setIsOpen(false) }),
        []
    )
    const popoverContentRef = useRef<HTMLDivElement>(null)

    const onOpenChange = useCallback(
        (open: boolean): void => {
            popoverRootProps?.onOpenChange?.(open)
            setIsOpen(open)
            if (
                document.activeElement instanceof HTMLElement &&
                popoverContentRef.current?.contains(document.activeElement)
            ) {
                anchorRef.current?.focus()
            }
        },
        [popoverRootProps?.onOpenChange]
    )

    const close = useCallback(() => {
        onOpenChange(false)
    }, [onOpenChange])

    const onKeyDownInPopoverContent = useCallback<KeyboardEventHandler<HTMLDivElement>>(
        event => {
            if (event.key === 'Escape') {
                onCloseByEscape?.()
            }
            popoverContentProps?.onKeyDown?.(event)
        },
        [onCloseByEscape, popoverContentProps?.onKeyDown]
    )

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
            <PopoverTrigger asChild={true}>
                <ToolbarButton
                    variant="secondary"
                    iconEnd={iconEnd ?? undefined}
                    ref={anchorRef}
                    onClick={onButtonClick}
                    tooltip={tooltip}
                    {...props}
                >
                    {children}
                </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                onKeyDown={onKeyDownInPopoverContent}
                ref={popoverContentRef}
                {...popoverContentProps}
            >
                {popoverContent(close)}
            </PopoverContent>
        </Popover>
    )
}
ToolbarPopoverItem.displayName = 'ToolbarPopoverItem'

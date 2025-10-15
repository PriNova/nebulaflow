import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { clsx } from 'clsx'
import { ChevronRight } from 'lucide-react'
import * as React from 'react'
import styles from './accordion.module.css'

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
    React.ElementRef<typeof AccordionPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
    <AccordionPrimitive.Item ref={ref} className={className} {...props} />
))
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = React.forwardRef<
    React.ElementRef<typeof AccordionPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Header className="tw-flex">
        <AccordionPrimitive.Trigger
            ref={ref}
            className={clsx(styles['accordion-trigger'], className)}
            {...props}
        >
            {children}
            {!props.disabled && (
                <ChevronRight
                    className={clsx(
                        'tw-h-4 tw-w-4 tw-text-muted-foreground',
                        styles['accordion-trigger-chevron']
                    )}
                />
            )}
        </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = 'AccordionTrigger'

interface AccordionContentProps
    extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> {
    overflow?: boolean
}

const AccordionContent = React.forwardRef<
    React.ElementRef<typeof AccordionPrimitive.Content>,
    AccordionContentProps
>(({ className, overflow, children, ...props }, ref) => (
    <AccordionPrimitive.Content
        ref={ref}
        className={clsx(
            'tw-transition-all data-[state=closed]:tw-animate-accordion-up data-[state=open]:tw-animate-accordion-down',
            { 'tw-overflow-hidden': !overflow }
        )}
        {...props}
    >
        <div className={className}>{children}</div>
    </AccordionPrimitive.Content>
))
AccordionContent.displayName = 'AccordionContent'

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './cn.ts';

/**
 * Button styles.
 *
 * Built on the `.btn` primitives in the shared theme rather than redefining
 * colours here, so the lab and the replay viewer stay visually identical.
 */
const buttonVariants = cva(
  'btn select-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: '',
        primary: 'btn-primary',
        ghost: 'border-transparent bg-transparent text-ink-dim hover:text-ink',
        danger: 'border-transparent bg-transparent text-ink-faint hover:border-warning/50 hover:text-warning',
      },
      size: {
        sm: 'h-7 gap-1.5 px-2 text-xs [&_svg]:size-3.5',
        md: 'h-8 gap-2 px-3 text-[0.8125rem] [&_svg]:size-4',
        icon: 'size-7 [&_svg]:size-3.5',
        'icon-sm': 'size-6 [&_svg]:size-3',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

type ButtonProps = React.ComponentPropsWithoutRef<'button'> & VariantProps<typeof buttonVariants>;

const Button = ({ className, size, variant, type = 'button', ...props }: ButtonProps): React.ReactNode => (
  <button className={cn(buttonVariants({ variant, size }), className)} type={type} {...props} />
);

export type { ButtonProps };
export { Button, buttonVariants };

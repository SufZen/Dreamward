import { forwardRef } from 'react';
import { cn } from '../lib/cn';

const base =
  'w-full rounded-md border border-border bg-surface text-foreground placeholder:text-fg-faint ' +
  'transition-[border-color,box-shadow] duration-150 ease-out focus:outline-none focus:border-primary ' +
  'focus:ring-[3px] focus:ring-[color:var(--rz-accent-ring)] ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-[color:var(--rz-danger-soft)]';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(base, 'h-9 px-3 text-sm', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, 'min-h-20 px-3 py-2.5 text-sm leading-relaxed resize-y', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

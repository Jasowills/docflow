import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const isFileInput = type === 'file';

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background/80 text-sm text-foreground ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          isFileInput
            ? 'p-0 leading-none file:mr-3 file:h-full file:cursor-pointer file:rounded-l-md file:rounded-r-none file:border-0 file:border-r file:border-input file:bg-muted file:px-4 file:text-sm file:font-semibold file:text-foreground file:transition-colors hover:file:bg-accent hover:file:text-accent-foreground'
            : 'px-3 py-2 placeholder:text-muted-foreground',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };

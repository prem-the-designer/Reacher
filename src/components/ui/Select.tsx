/**
 * Select — accessible dropdown for filters, role selectors, pagination size
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  onChange,
  label,
  placeholder,
  className,
  id,
  value,
  disabled,
  ...props
}) => {
  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-muted-foreground mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'block w-full appearance-none rounded-md border border-input bg-background',
            'pl-3 pr-8 py-2 text-sm text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A1A1A1]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-150',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

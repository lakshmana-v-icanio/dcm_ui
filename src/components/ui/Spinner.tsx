import { cn } from '../../lib/cn';

interface SpinnerProps {
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
  color?: 'inherit' | 'primary' | 'white';
}

export const Spinner = ({ size = 'md', className, color = 'primary' }: SpinnerProps) => {
  const px = typeof size === 'number' ? size : size === 'sm' ? 16 : size === 'lg' ? 32 : 20;
  const colorClass = color === 'white' ? 'text-white' : color === 'inherit' ? 'text-current' : 'text-primary-600';
  return (
    <svg
      className={cn('animate-spin shrink-0', colorClass, className)}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

export default Spinner;

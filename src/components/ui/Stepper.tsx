import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface StepperProps {
  steps: string[];
  activeStep: number;
  className?: string;
}

export const Stepper = ({ steps, activeStep, className }: StepperProps) => (
  <ol className={cn('flex items-center gap-0', className)}>
    {steps.map((label, i) => {
      const done = i < activeStep;
      const active = i === activeStep;
      const isLast = i === steps.length - 1;
      return (
        <li key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
              done ? 'bg-primary-600 border-primary-600 text-white'
                : active ? 'border-primary-600 text-primary-600 bg-white'
                : 'border-slate-300 text-slate-400 bg-white'
            )}>
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={cn(
              'text-xs font-medium whitespace-nowrap',
              active ? 'text-primary-600' : done ? 'text-slate-700' : 'text-slate-400'
            )}>{label}</span>
          </div>
          {!isLast && (
            <div className={cn('h-0.5 w-12 mx-1 mb-5 transition-colors', done ? 'bg-primary-600' : 'bg-slate-200')} />
          )}
        </li>
      );
    })}
  </ol>
);

export default Stepper;

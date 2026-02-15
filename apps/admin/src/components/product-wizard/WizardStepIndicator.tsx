import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStepLabel } from './product-family/familyConfig';

type WizardStepIndicatorProps = {
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
  visibleSteps: number[];
  onStepClick?: (step: number) => void;
};

export function WizardStepIndicator({
  currentStep,
  totalSteps,
  completedSteps,
  visibleSteps,
  onStepClick,
}: WizardStepIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Create Product</h1>
        <span className="text-sm text-muted-foreground">
          Step {currentStep} of {totalSteps}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {visibleSteps.map((stepNumber, index) => {
          const stepIndex = index + 1;
          const isCompleted = completedSteps.has(stepIndex);
          const isCurrent = stepIndex === currentStep;
          const isClickable = onStepClick && (isCompleted || stepIndex < currentStep);

          return (
            <div key={stepNumber} className="flex items-center flex-1">
              <button
                onClick={() => isClickable && onStepClick(stepIndex)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center gap-2 w-full transition-all',
                  isClickable && 'cursor-pointer hover:opacity-80',
                  !isClickable && 'cursor-default'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all',
                    isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                    isCompleted && !isCurrent && 'bg-green-500 text-white',
                    !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check size={16} /> : stepIndex}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium truncate',
                      isCurrent && 'text-foreground',
                      !isCurrent && 'text-muted-foreground'
                    )}
                  >
                    {getStepLabel(stepNumber)}
                  </p>
                </div>
              </button>

              {stepIndex < totalSteps && (
                <div
                  className={cn(
                    'h-[2px] flex-1 mx-2 transition-all',
                    isCompleted ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

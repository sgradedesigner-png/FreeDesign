import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';

type WizardNavigationProps = {
  currentStep: number;
  totalSteps: number;
  onNext: () => Promise<boolean>;
  onPrev: () => void;
  onSave?: () => void;
  isValid?: boolean;
  isSubmitting?: boolean;
  saveLabel?: string;
};

export function WizardNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSave,
  isValid = true,
  isSubmitting = false,
  saveLabel = 'Create Product',
}: WizardNavigationProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  const handleNext = async () => {
    const success = await onNext();
    if (!success) {
      // Scroll to first error
      const firstError = document.querySelector('[data-error="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div className="sticky bottom-0 bg-background border-t py-4 mt-8">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          disabled={isFirstStep || isSubmitting}
          className="min-w-[120px]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {!isLastStep ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            onSave && (
              <Button
                type="button"
                onClick={onSave}
                disabled={!isValid || isSubmitting}
                className="min-w-[200px]"
              >
                {isSubmitting ? (
                  <>
                    <Save className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {saveLabel}
                  </>
                )}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

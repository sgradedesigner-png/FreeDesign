import { CheckCircle2, Loader2 } from 'lucide-react';

type AutoSaveIndicatorProps = {
  isSaving: boolean;
};

export function AutoSaveIndicator({ isSaving }: AutoSaveIndicatorProps) {
  if (!isSaving) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 size={14} className="text-green-600" />
        <span>Draft saved</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 size={14} className="animate-spin" />
      <span>Saving draft...</span>
    </div>
  );
}

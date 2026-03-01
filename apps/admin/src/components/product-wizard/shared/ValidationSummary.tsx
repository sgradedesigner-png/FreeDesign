import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { FieldErrors } from 'react-hook-form';

type ValidationSummaryProps = {
  errors: FieldErrors;
};

export function ValidationSummary({ errors }: ValidationSummaryProps) {
  const errorEntries = Object.entries(errors);

  if (errorEntries.length === 0) {
    return null;
  }

  const formatFieldName = (field: string): string => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Recursively collect all leaf error messages with their field paths
  const collectErrors = (error: any, prefix = ''): { path: string; message: string }[] => {
    if (!error) return [];
    if (typeof error === 'string') return [{ path: prefix, message: error }];
    if (error?.message && typeof error.message === 'string') {
      return [{ path: prefix, message: error.message }];
    }
    if (Array.isArray(error)) {
      return error.flatMap((item, idx) =>
        collectErrors(item, prefix ? `${prefix}[${idx + 1}]` : `[${idx + 1}]`)
      );
    }
    if (typeof error === 'object') {
      return Object.entries(error).flatMap(([key, val]) =>
        collectErrors(val, prefix ? `${prefix} › ${formatFieldName(key)}` : formatFieldName(key))
      );
    }
    return [{ path: prefix, message: 'Invalid value' }];
  };

  const allErrors = errorEntries.flatMap(([field, error]) =>
    collectErrors(error, formatFieldName(field))
  );

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle size={20} />
          Validation Errors
        </CardTitle>
        <CardDescription>Please fix the following errors before proceeding</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {allErrors.map(({ path, message }, i) => (
            <Alert key={i} variant="destructive" data-error="true">
              <AlertDescription>
                <strong>{path}:</strong> {message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

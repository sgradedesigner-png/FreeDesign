import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldErrors } from 'react-hook-form';

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

  const getErrorMessage = (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (Array.isArray(error)) return 'Multiple errors';
    return 'Invalid value';
  };

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
          {errorEntries.map(([field, error]) => (
            <Alert key={field} variant="destructive" data-error="true">
              <AlertDescription>
                <strong>{formatFieldName(field)}:</strong> {getErrorMessage(error)}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

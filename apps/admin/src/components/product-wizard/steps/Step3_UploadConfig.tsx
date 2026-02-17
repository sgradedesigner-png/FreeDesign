import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { WizardFormData, UploadConstraints } from '@/hooks/useProductWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step3_UploadConfigProps = {
  form: UseFormReturn<WizardFormData>;
};

const FILE_FORMATS = ['PNG', 'JPEG', 'PDF', 'SVG'];

function getUploadDefaults(family: string): UploadConstraints {
  if (family === 'GANG_UPLOAD' || family === 'UV_GANG_UPLOAD') {
    return {
      maxFileSizeMB: 50,
      minDPI: 150,
      minWidth: 1200,
      minHeight: 1200,
      allowedFormats: ['PNG', 'JPEG', 'PDF'],
    };
  }
  if (family === 'GANG_BUILDER' || family === 'UV_GANG_BUILDER') {
    return {
      maxFileSizeMB: 20,
      minDPI: 0,
      minWidth: 800,
      minHeight: 800,
      allowedFormats: ['PNG', 'JPEG', 'SVG'],
    };
  }
  return {
    maxFileSizeMB: 20,
    minDPI: 0,
    minWidth: 800,
    minHeight: 800,
    allowedFormats: ['PNG', 'JPEG'],
  };
}

export function Step3_UploadConfig({ form }: Step3_UploadConfigProps) {
  const productFamily = form.watch('productFamily');
  const constraints = form.watch('uploadConstraints');

  useEffect(() => {
    if (!constraints) {
      const defaults = getUploadDefaults(productFamily);
      form.setValue('uploadConstraints', defaults, { shouldValidate: true });
    }
  }, [productFamily, constraints, form]);

  const toggleFormat = (format: string) => {
    const currentFormats = form.watch('uploadConstraints.allowedFormats') || [];
    const newFormats = currentFormats.includes(format)
      ? currentFormats.filter((f) => f !== format)
      : [...currentFormats, format];
    form.setValue('uploadConstraints.allowedFormats', newFormats, { shouldValidate: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Requirements</CardTitle>
        <CardDescription>Configure file upload constraints for customers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxFileSizeMB">Max File Size (MB)</Label>
            <Input
              id="maxFileSizeMB"
              type="number"
              min="1"
              max="100"
              {...form.register('uploadConstraints.maxFileSizeMB', { valueAsNumber: true })}
              placeholder="50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minDPI">Min DPI (0 = any)</Label>
            <Input
              id="minDPI"
              type="number"
              min="0"
              max="600"
              {...form.register('uploadConstraints.minDPI', { valueAsNumber: true })}
              placeholder="150"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minWidth">Min Width (px)</Label>
            <Input
              id="minWidth"
              type="number"
              min="1"
              {...form.register('uploadConstraints.minWidth', { valueAsNumber: true })}
              placeholder="1200"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minHeight">Min Height (px)</Label>
            <Input
              id="minHeight"
              type="number"
              min="1"
              {...form.register('uploadConstraints.minHeight', { valueAsNumber: true })}
              placeholder="1200"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Allowed Formats</Label>
          <div className="flex gap-2 mt-2">
            {FILE_FORMATS.map((format) => (
              <Badge
                key={format}
                variant={constraints?.allowedFormats?.includes(format) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-all',
                  constraints?.allowedFormats?.includes(format)
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => toggleFormat(format)}
              >
                {format}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-2">Customer Preview</h4>
          <p className="text-sm text-muted-foreground mb-4">
            This is what customers will see when uploading files:
          </p>
          <ConstraintPreview constraints={constraints} />
        </div>
      </CardContent>
    </Card>
  );
}

function ConstraintPreview({ constraints }: { constraints?: UploadConstraints }) {
  if (!constraints) return null;

  return (
    <div className="border-2 border-dashed border-border rounded-lg p-6 bg-muted/30">
      <Upload size={48} className="mx-auto text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-center mb-2">Upload Your Design</p>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Max {constraints.maxFileSizeMB} MB</p>
        {constraints.minDPI && constraints.minDPI > 0 && (
          <p>• {constraints.minDPI} DPI or higher</p>
        )}
        <p>
          • At least {constraints.minWidth}×{constraints.minHeight} pixels
        </p>
        <p>• {(constraints.allowedFormats ?? []).join(', ')} format</p>
      </div>
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductFamilyConfig } from './familyConfig';

type ProductFamilyCardProps = {
  family: ProductFamilyConfig;
  selected: boolean;
  onSelect: () => void;
};

export function ProductFamilyCard({ family, selected, onSelect }: ProductFamilyCardProps) {
  const Icon = family.icon;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg',
        selected && 'ring-2 ring-primary shadow-lg'
      )}
      onClick={onSelect}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                selected ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              <Icon size={24} />
            </div>
            <div>
              <CardTitle className="text-lg">{family.label}</CardTitle>
              {selected && (
                <Badge variant="default" className="mt-1">
                  <Check size={12} className="mr-1" />
                  Selected
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-3">{family.description}</CardDescription>
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          <strong>Example:</strong> {family.example}
        </div>
      </CardContent>
    </Card>
  );
}

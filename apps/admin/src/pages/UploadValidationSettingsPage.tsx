import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/context/LanguageContext';

type UploadFamily = 'gang_upload' | 'uv_gang_upload' | 'by_size' | 'uv_by_size' | 'blanks';

type SettingsResponse = {
  settings: Array<{
    key: string;
    value: unknown;
    category: string;
  }>;
};

type FamilyFormState = {
  enabled: boolean;
  mockupPreviewEnabled: boolean;
  maxBytes: number;
  minDpi: number;
  minWidthPx: number;
  minHeightPx: number;
  allowedTypes: string[];
};

type UploadValidationFormState = {
  globalEnabled: boolean;
  showPlacementCoordinates: boolean;
  sizeFinderEnabled: boolean;
  families: Record<UploadFamily, FamilyFormState>;
};

const FAMILY_DEFS: Array<{
  key: UploadFamily;
  title: string;
  defaultValues: FamilyFormState;
  mimeOptions: string[];
}> = [
    {
      key: 'gang_upload',
      title: 'Gang Upload',
      defaultValues: {
        enabled: true,
        mockupPreviewEnabled: true,
        maxBytes: 50 * 1024 * 1024,
        minDpi: 150,
        minWidthPx: 1200,
        minHeightPx: 0,
        allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
      },
      mimeOptions: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
    },
    {
      key: 'uv_gang_upload',
      title: 'UV Gang Upload',
      defaultValues: {
        enabled: true,
        mockupPreviewEnabled: true,
        maxBytes: 50 * 1024 * 1024,
        minDpi: 150,
        minWidthPx: 1200,
        minHeightPx: 0,
        allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
      },
      mimeOptions: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
    },
    {
      key: 'by_size',
      title: 'By Size',
      defaultValues: {
        enabled: true,
        mockupPreviewEnabled: true,
        maxBytes: 20 * 1024 * 1024,
        minDpi: 0,
        minWidthPx: 800,
        minHeightPx: 800,
        allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'],
      },
      mimeOptions: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'],
    },
    {
      key: 'uv_by_size',
      title: 'UV By Size',
      defaultValues: {
        enabled: true,
        mockupPreviewEnabled: true,
        maxBytes: 20 * 1024 * 1024,
        minDpi: 0,
        minWidthPx: 800,
        minHeightPx: 800,
        allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'],
      },
      mimeOptions: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'],
    },
    {
      key: 'blanks',
      title: 'Blanks',
      defaultValues: {
        enabled: true,
        mockupPreviewEnabled: true,
        maxBytes: 20 * 1024 * 1024,
        minDpi: 0,
        minWidthPx: 800,
        minHeightPx: 800,
        allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'],
      },
      mimeOptions: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'],
    },
  ];

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const parsed = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  return fallback;
}

function buildInitialState(settings: SettingsResponse['settings']): UploadValidationFormState {
  const map = new Map(settings.map((item) => [item.key, item.value]));
  const families = {} as Record<UploadFamily, FamilyFormState>;

  for (const familyDef of FAMILY_DEFS) {
    const { key, defaultValues } = familyDef;
    families[key] = {
      enabled: toBoolean(map.get(`upload.${key}.enabled`), defaultValues.enabled),
      mockupPreviewEnabled: toBoolean(map.get(`upload.${key}.mockupPreviewEnabled`), defaultValues.mockupPreviewEnabled),
      maxBytes: toNumber(map.get(`upload.${key}.maxBytes`), defaultValues.maxBytes),
      minDpi: toNumber(map.get(`upload.${key}.minDpi`), defaultValues.minDpi),
      minWidthPx: toNumber(map.get(`upload.${key}.minWidthPx`), defaultValues.minWidthPx),
      minHeightPx: toNumber(map.get(`upload.${key}.minHeightPx`), defaultValues.minHeightPx),
      allowedTypes: toStringArray(map.get(`upload.${key}.allowedTypes`), defaultValues.allowedTypes),
    };
  }

  return {
    globalEnabled: toBoolean(map.get('upload.validation.enabled'), true),
    showPlacementCoordinates: toBoolean(map.get('upload.debug.showPlacementCoordinates'), true),
    sizeFinderEnabled: toBoolean(map.get('upload.ui.sizeFinderEnabled'), true),
    families,
  };
}

export default function UploadValidationSettingsPage() {
  const { language } = useLanguage();
  const [formState, setFormState] = useState<UploadValidationFormState | null>(null);

  const query = useQuery({
    queryKey: ['admin-upload-validation-settings'],
    queryFn: async () => {
      const res = await api.get<SettingsResponse>('/api/admin/settings', {
        params: { category: 'upload_validation' },
      });
      return res.data;
    },
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { settings: Array<{ key: string; value: unknown }> }) => {
      const res = await api.put('/api/admin/settings/batch', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success(language === 'en' ? 'Upload settings saved' : 'Upload тохиргоо хадгалагдлаа');
      query.refetch();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to save upload settings');
    },
  });

  const effectiveState = useMemo(() => {
    if (formState) return formState;
    if (!query.data) return null;
    return buildInitialState(query.data.settings);
  }, [formState, query.data]);

  const setFamilyField = (
    family: UploadFamily,
    field: keyof Omit<FamilyFormState, 'allowedTypes'>,
    value: number | boolean
  ) => {
    if (!effectiveState) return;
    setFormState({
      ...effectiveState,
      families: {
        ...effectiveState.families,
        [family]: {
          ...effectiveState.families[family],
          [field]: value,
        },
      },
    });
  };

  const toggleFamilyMime = (family: UploadFamily, mimeType: string, checked: boolean) => {
    if (!effectiveState) return;
    const current = new Set(effectiveState.families[family].allowedTypes);
    if (checked) current.add(mimeType);
    else current.delete(mimeType);
    setFormState({
      ...effectiveState,
      families: {
        ...effectiveState.families,
        [family]: {
          ...effectiveState.families[family],
          allowedTypes: Array.from(current),
        },
      },
    });
  };

  const saveAll = () => {
    if (!effectiveState) return;

    const settings: Array<{ key: string; value: unknown }> = [
      { key: 'upload.validation.enabled', value: effectiveState.globalEnabled },
      { key: 'upload.debug.showPlacementCoordinates', value: effectiveState.showPlacementCoordinates },
      { key: 'upload.ui.sizeFinderEnabled', value: effectiveState.sizeFinderEnabled },
    ];

    for (const familyDef of FAMILY_DEFS) {
      const family = familyDef.key;
      const data = effectiveState.families[family];
      settings.push({ key: `upload.${family}.enabled`, value: data.enabled });
      settings.push({ key: `upload.${family}.mockupPreviewEnabled`, value: data.mockupPreviewEnabled });
      settings.push({ key: `upload.${family}.maxBytes`, value: Math.max(1, Math.floor(data.maxBytes)) });
      settings.push({ key: `upload.${family}.minDpi`, value: Math.max(0, Math.floor(data.minDpi)) });
      settings.push({ key: `upload.${family}.minWidthPx`, value: Math.max(0, Math.floor(data.minWidthPx)) });
      settings.push({ key: `upload.${family}.minHeightPx`, value: Math.max(0, Math.floor(data.minHeightPx)) });
      settings.push({ key: `upload.${family}.allowedTypes`, value: data.allowedTypes });
    }

    saveMutation.mutate({ settings });
  };

  if (query.isLoading && !effectiveState) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Loading upload validation settings...
      </div>
    );
  }

  if (!effectiveState) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Upload Validation Settings</h1>
        <p className="text-sm text-muted-foreground">Failed to load settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Validation Settings</h1>
        <p className="text-muted-foreground mt-1">
          Turn validation on/off and adjust constraints per upload family.
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Global Validation</CardTitle>
          <CardDescription>Master toggle for upload validation checks across all families.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Checkbox
              checked={effectiveState.globalEnabled}
              onCheckedChange={(checked) =>
                setFormState({
                  ...effectiveState,
                  globalEnabled: Boolean(checked),
                })
              }
            />
            <Label>Enable upload validation globally</Label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Checkbox
              checked={effectiveState.showPlacementCoordinates}
              onCheckedChange={(checked) =>
                setFormState({
                  ...effectiveState,
                  showPlacementCoordinates: Boolean(checked),
                })
              }
            />
            <Label>{language === 'en' ? 'Show placement coordinates in Store' : 'Store дээр байрлалын координат харуулах'}</Label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Checkbox
              checked={effectiveState.sizeFinderEnabled}
              onCheckedChange={(checked) =>
                setFormState({
                  ...effectiveState,
                  sizeFinderEnabled: Boolean(checked),
                })
              }
            />
            <Label>{language === 'en' ? 'Enable "Find my size" in Store PDP' : 'Store PDP дээр "Миний хэмжээг ол" харуулах'}</Label>
          </div>
        </CardContent>
      </Card>

      {FAMILY_DEFS.map((familyDef) => {
        const familyState = effectiveState.families[familyDef.key];
        const maxMb = Math.round(familyState.maxBytes / (1024 * 1024));
        return (
          <Card key={familyDef.key}>
            <CardHeader>
              <CardTitle>{familyDef.title}</CardTitle>
              <CardDescription>Configure validation constraints for this upload family.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={familyState.enabled}
                  onCheckedChange={(checked) => setFamilyField(familyDef.key, 'enabled', Boolean(checked))}
                />
                <Label>Enabled</Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  checked={familyState.mockupPreviewEnabled}
                  onCheckedChange={(checked) => setFamilyField(familyDef.key, 'mockupPreviewEnabled', Boolean(checked))}
                />
                <Label>{language === 'en' ? 'Mockup Preview' : 'Mockup Preview харуулах'}</Label>
                <span className="text-xs text-muted-foreground">
                  {language === 'en'
                    ? 'Show server-rendered preview to customers'
                    : 'Хэрэглэгчид хэвлэлтийн preview харуулах'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Size (MB)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxMb}
                    onChange={(e) => {
                      const mb = Number(e.target.value) || 0;
                      setFamilyField(familyDef.key, 'maxBytes', mb * 1024 * 1024);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min DPI</Label>
                  <Input
                    type="number"
                    min={0}
                    value={familyState.minDpi}
                    onChange={(e) => setFamilyField(familyDef.key, 'minDpi', Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Width (px)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={familyState.minWidthPx}
                    onChange={(e) => setFamilyField(familyDef.key, 'minWidthPx', Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Height (px)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={familyState.minHeightPx}
                    onChange={(e) => setFamilyField(familyDef.key, 'minHeightPx', Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Allowed Types</Label>
                <div className="flex flex-wrap gap-4">
                  {familyDef.mimeOptions.map((mime) => (
                    <label key={mime} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={familyState.allowedTypes.includes(mime)}
                        onCheckedChange={(checked) => toggleFamilyMime(familyDef.key, mime, Boolean(checked))}
                      />
                      <span>{mime}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={saveAll} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}

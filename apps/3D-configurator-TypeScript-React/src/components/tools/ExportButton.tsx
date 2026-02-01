// src/components/tools/ExportButton.tsx
import { useState, useCallback } from 'react';
import { Download, Loader2, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfiguratorStore } from '@/stores';
import { useI18n } from '@/hooks';
import {
  buildExportPackage,
  downloadAllExportFiles,
} from '@/services/exportService';
import type { ExportPackage } from '@/types/export';

interface ExportButtonProps {
  className?: string;
}

export function ExportButton({ className = '' }: ExportButtonProps) {
  const { t } = useI18n();
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPackage | null>(null);

  // Get data from store
  const zoneDrafts = useConfiguratorStore((s) => s.zoneDrafts);
  const baseColor = useConfiguratorStore((s) => s.baseColor);

  // Check if there are any designs to export
  const hasDesigns = useCallback(() => {
    for (const [, draft] of zoneDrafts) {
      if (draft?.image && draft?.placement) {
        return true;
      }
    }
    return false;
  }, [zoneDrafts]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!hasDesigns()) {
      return;
    }

    setIsExporting(true);
    setExportComplete(false);

    try {
      // Build export package
      const exportPackage = await buildExportPackage(zoneDrafts, baseColor, {
        dpi: 300,
        templatePx: 4096,
      });

      setLastExport(exportPackage);

      // Download all files
      await downloadAllExportFiles(exportPackage);

      setExportComplete(true);

      // Reset complete state after 3 seconds
      setTimeout(() => {
        setExportComplete(false);
      }, 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [zoneDrafts, baseColor, hasDesigns]);

  const canExport = hasDesigns();

  return (
    <div className={`space-y-2 ${className}`}>
      <Button
        onClick={handleExport}
        disabled={!canExport || isExporting}
        className="w-full"
        variant={exportComplete ? 'default' : 'outline'}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('export.exporting')}
          </>
        ) : exportComplete ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            {t('export.complete')}
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            {t('export.button')}
          </>
        )}
      </Button>

      {!canExport && (
        <p className="text-xs text-muted-foreground text-center">
          {t('export.noDesigns')}
        </p>
      )}

      {lastExport && exportComplete && (
        <div className="p-2 bg-muted/50 rounded-md text-xs space-y-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Package className="h-3 w-3" />
            <span>{t('export.summary')}</span>
          </div>
          <ul className="pl-4 space-y-0.5 text-muted-foreground">
            <li>
              {t('export.zonesExported')}: {lastExport.summary.totalZonesWithDesign}
            </li>
            <li>
              {t('export.zones')}: {lastExport.summary.zoneKeys.join(', ')}
            </li>
            <li>
              {t('export.color')}: {lastExport.product.color}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

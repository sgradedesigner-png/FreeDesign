import { useTheme } from '../../context/ThemeContext';

export type GangSheetLength = 30 | 50 | 70 | 100;

interface GangSheetLengthSelectorProps {
  selectedLength: GangSheetLength;
  onLengthChange: (length: GangSheetLength) => void;
  disabled?: boolean;
}

const LENGTH_OPTIONS: GangSheetLength[] = [30, 50, 70, 100];

/**
 * Gang Sheet Length Selector Component
 * Allows users to select gang sheet length (30cm, 50cm, 70cm, 100cm)
 */
export function GangSheetLengthSelector({
  selectedLength,
  onLengthChange,
  disabled = false,
}: GangSheetLengthSelectorProps) {
  const { language } = useTheme();

  return (
    <div data-testid="gang-sheet-length-selector">
      <label className="block text-sm font-medium text-foreground mb-2">
        {language === 'mn' ? 'Gang Sheet урт' : 'Gang Sheet Length'}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {LENGTH_OPTIONS.map((length) => (
          <button
            key={length}
            data-testid={`gang-sheet-length-${length}`}
            onClick={() => onLengthChange(length)}
            disabled={disabled}
            className={`px-4 py-3 border rounded-lg text-sm font-medium transition-all ${
              selectedLength === length
                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                : 'border-border hover:border-primary/50 text-foreground disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <div className="font-semibold">{length}cm</div>
            <div className="text-xs opacity-80">
              {language === 'mn' ? 'Урт' : 'Length'}
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {language === 'mn'
          ? 'Gang sheet-ийн урт нь үнэд нөлөөлнө. Том gang sheet хямд байна.'
          : 'Gang sheet length affects price. Larger gang sheets are more cost-effective.'}
      </p>
    </div>
  );
}

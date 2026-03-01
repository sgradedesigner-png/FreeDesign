import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type UploadStatus = 'pending' | 'processing' | 'passed' | 'failed' | 'dead_letter';

interface UploadStatusChipProps {
  status: UploadStatus;
  errorMessage?: string;
  className?: string;
}

/** Map raw backend error strings to user-friendly messages */
function getFriendlyError(raw: string | undefined, language: string): string | null {
  if (!raw) return null;

  const lower = raw.toLowerCase();

  if (lower.includes('dpi') || lower.includes('resolution')) {
    return language === 'mn'
      ? 'Зургийн нягтрал хангалтгүй байна. Хамгийн багадаа 150 DPI шаардлагатай.'
      : 'Image resolution is too low. Minimum 150 DPI required.';
  }
  if (lower.includes('width') || lower.includes('dimension') || lower.includes('size') || lower.includes('1200')) {
    return language === 'mn'
      ? 'Зургийн хэмжээ хэтэрхий жижиг байна. Өргөн нь хамгийн багадаа 1200px байх ёстой.'
      : 'Image dimensions are too small. Minimum width is 1200px.';
  }
  if (lower.includes('format') || lower.includes('type') || lower.includes('mime')) {
    return language === 'mn'
      ? 'Файлын формат дэмжигдэхгүй байна. PNG, JPEG, эсвэл PDF оруулна уу.'
      : 'Unsupported file format. Please upload PNG, JPEG, or PDF.';
  }
  if (lower.includes('corrupt') || lower.includes('invalid') || lower.includes('read')) {
    return language === 'mn'
      ? 'Файл унших боломжгүй байна. Гэмтсэн файл байж болзошгүй.'
      : 'File could not be read. It may be corrupted.';
  }
  if (lower.includes('family') || lower.includes('upload family')) {
    return language === 'mn'
      ? 'Файлыг шалгах боломжгүй болсон. Дахин upload хийнэ үү.'
      : 'Validation could not be completed. Please try uploading again.';
  }

  // Generic fallback — don't show raw technical message
  return language === 'mn'
    ? 'Файл шалгалтад тэнцсэнгүй. Дахин upload хийх эсвэл өөр файл оруулна уу.'
    : 'Validation failed. Please try uploading again or use a different file.';
}

/**
 * Upload Status Chip Component
 * Displays upload validation status with appropriate icon, label and description.
 */
export function UploadStatusChip({
  status,
  errorMessage,
  className = '',
}: UploadStatusChipProps) {
  const { language } = useTheme();

  const statusConfig: Record<
    UploadStatus,
    {
      icon: React.ElementType;
      label: string;
      description: string;
      bgColor: string;
      textColor: string;
      borderColor: string;
      spin?: boolean;
    }
  > = {
    pending: {
      icon: Clock,
      label: language === 'mn' ? 'Дараалалд хүлээгдэж байна' : 'Queued for validation',
      description:
        language === 'mn'
          ? 'Таны файл шалгагдахаар жишээнд байна. Хэдэн секундын дотор шалгагдана.'
          : 'Your file is in the validation queue and will be checked shortly.',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      borderColor: 'border-yellow-300 dark:border-yellow-700',
    },
    processing: {
      icon: Loader2,
      label: language === 'mn' ? 'Шалгаж байна...' : 'Validating...',
      description:
        language === 'mn'
          ? 'Файлын нягтрал, хэмжээ болон форматыг шалгаж байна.'
          : 'Checking file resolution, dimensions, and format.',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-800 dark:text-blue-300',
      borderColor: 'border-blue-300 dark:border-blue-700',
      spin: true,
    },
    passed: {
      icon: CheckCircle2,
      label: language === 'mn' ? 'Шалгалт амжилттай' : 'Ready to print',
      description:
        language === 'mn'
          ? 'Файл хэвлэлтэд бэлэн байна. Сагсанд нэмж болно.'
          : 'Your file passed all checks. You can now add to cart.',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-800 dark:text-green-300',
      borderColor: 'border-green-300 dark:border-green-700',
    },
    failed: {
      icon: XCircle,
      label: language === 'mn' ? 'Шалгалт амжилтгүй' : 'Validation failed',
      description:
        getFriendlyError(errorMessage, language) ??
        (language === 'mn'
          ? 'Файл шаардлага хангасангүй. Дахин upload хийнэ үү.'
          : 'File did not meet requirements. Please upload a new file.'),
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-800 dark:text-red-300',
      borderColor: 'border-red-300 dark:border-red-700',
    },
    dead_letter: {
      icon: AlertCircle,
      label: language === 'mn' ? 'Шалгах боломжгүй болсон' : 'Validation unavailable',
      description:
        language === 'mn'
          ? 'Техникийн алдааны улмаас файлыг шалгах боломжгүй болсон. Файлаа устгаад дахин upload хийнэ үү.'
          : 'A technical error prevented validation. Please remove this file and try again.',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-800 dark:text-orange-300',
      borderColor: 'border-orange-300 dark:border-orange-700',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`${className}`} data-testid={`upload-status-chip-${status}`}>
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      >
        <Icon size={16} className={config.spin ? 'animate-spin' : ''} />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
      <p className={`text-xs mt-1.5 ml-1 ${config.textColor} opacity-90`} data-testid="upload-status-description">
        {config.description}
      </p>
    </div>
  );
}

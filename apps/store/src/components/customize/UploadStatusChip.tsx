import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type UploadStatus = 'pending' | 'processing' | 'passed' | 'failed' | 'dead_letter';

interface UploadStatusChipProps {
  status: UploadStatus;
  errorMessage?: string;
  className?: string;
}

/**
 * Upload Status Chip Component
 * Displays upload validation status with appropriate icon and color
 */
export function UploadStatusChip({
  status,
  errorMessage,
  className = '',
}: UploadStatusChipProps) {
  const { language } = useTheme();

  const statusConfig = {
    pending: {
      icon: Clock,
      label: language === 'mn' ? 'Хүлээгдэж буй' : 'Pending',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      borderColor: 'border-yellow-300 dark:border-yellow-700',
    },
    processing: {
      icon: Clock,
      label: language === 'mn' ? 'Боловсруулж буй' : 'Processing',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-800 dark:text-blue-300',
      borderColor: 'border-blue-300 dark:border-blue-700',
    },
    passed: {
      icon: CheckCircle2,
      label: language === 'mn' ? 'Амжилттай' : 'Validated',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      textColor: 'text-green-800 dark:text-green-300',
      borderColor: 'border-green-300 dark:border-green-700',
    },
    failed: {
      icon: XCircle,
      label: language === 'mn' ? 'Алдаатай' : 'Failed',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      textColor: 'text-red-800 dark:text-red-300',
      borderColor: 'border-red-300 dark:border-red-700',
    },
    dead_letter: {
      icon: AlertCircle,
      label: language === 'mn' ? 'Алдаа' : 'Error',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      textColor: 'text-red-800 dark:text-red-300',
      borderColor: 'border-red-300 dark:border-red-700',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`${className}`}>
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      >
        <Icon size={16} className={status === 'processing' ? 'animate-spin' : ''} />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
      {status === 'failed' && errorMessage && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1 ml-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

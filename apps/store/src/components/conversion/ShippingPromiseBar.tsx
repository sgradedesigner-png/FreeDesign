import { useEffect, useState } from 'react';
import { Clock, Truck } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

type ShippingPromiseBarProps = {
  /**
   * Cutoff hour in 24h format (UB timezone assumed)
   * Default: 15 (3:00 PM)
   */
  cutoffHour?: number;
  /**
   * Enable/disable the countdown timer
   */
  showCountdown?: boolean;
  /**
   * Custom className
   */
  className?: string;
};

/**
 * Calculate time remaining until cutoff
 */
function getTimeUntilCutoff(cutoffHour: number): {
  hours: number;
  minutes: number;
  isPastCutoff: boolean;
} {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(cutoffHour, 0, 0, 0);

  // If current time is past cutoff, calculate for tomorrow
  if (now >= cutoff) {
    cutoff.setDate(cutoff.getDate() + 1);
  }

  const diff = cutoff.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return {
    hours,
    minutes,
    isPastCutoff: now.getHours() >= cutoffHour,
  };
}

/**
 * ShippingPromiseBar - Urgency conversion element
 *
 * Displays shipping cutoff time and countdown to create urgency.
 * Can be toggled with feature flag.
 *
 * @example
 * <ShippingPromiseBar cutoffHour={15} showCountdown />
 */
export default function ShippingPromiseBar({
  cutoffHour = 15,
  showCountdown = true,
  className = '',
}: ShippingPromiseBarProps) {
  const { language } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState(getTimeUntilCutoff(cutoffHour));

  useEffect(() => {
    if (!showCountdown) return;

    const interval = setInterval(() => {
      setTimeRemaining(getTimeUntilCutoff(cutoffHour));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [cutoffHour, showCountdown]);

  const { hours, minutes, isPastCutoff } = timeRemaining;

  // Message variants
  const message = isPastCutoff
    ? language === 'mn'
      ? `Маргааш ${cutoffHour}:00 хүртэл захиалвал өнөөдөр илгээнэ`
      : `Order before ${cutoffHour}:00 tomorrow for same-day dispatch`
    : language === 'mn'
      ? `Өнөөдөр ${cutoffHour}:00 хүртэл захиалвал өнөөдөр илгээнэ`
      : `Order within next ${hours}h ${minutes}m for same-day dispatch`;

  return (
    <div
      className={`flex items-center justify-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg ${className}`}
    >
      {showCountdown && !isPastCutoff ? (
        <>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
            <Clock size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {language === 'mn' ? 'Яаралтай хүргэлт' : 'Fast Dispatch'}
            </p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
            <span>{hours}</span>
            <span>:</span>
            <span>{String(minutes).padStart(2, '0')}</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary">
            <Truck size={16} />
          </div>
          <p className="text-sm font-medium text-foreground">{message}</p>
        </>
      )}
    </div>
  );
}

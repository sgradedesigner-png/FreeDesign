import { ShieldCheck, Truck, CreditCard, HeadphonesIcon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

type TrustBadgeVariant = 'default' | 'compact' | 'minimal';

type TrustBadgesProps = {
  variant?: TrustBadgeVariant;
  className?: string;
  showSecurePayment?: boolean;
  showFreeShipping?: boolean;
  showQualityGuarantee?: boolean;
  showSupport?: boolean;
};

type Badge = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: { mn: string; en: string };
  sublabel?: { mn: string; en: string };
};

const badges: Record<string, Badge> = {
  securePayment: {
    icon: CreditCard,
    label: { mn: 'Найдвартай төлбөр', en: 'Secure Payment' },
    sublabel: { mn: '100% аюулгүй', en: '100% secure' },
  },
  freeShipping: {
    icon: Truck,
    label: { mn: 'Үнэгүй хүргэлт', en: 'Free Shipping' },
    sublabel: { mn: '₮50,000+', en: 'On orders ₮50,000+' },
  },
  qualityGuarantee: {
    icon: ShieldCheck,
    label: { mn: 'Чанарын баталгаа', en: 'Quality Guarantee' },
    sublabel: { mn: '30 хоног буцаалт', en: '30-day returns' },
  },
  support: {
    icon: HeadphonesIcon,
    label: { mn: '24/7 Дэмжлэг', en: '24/7 Support' },
    sublabel: { mn: 'Хариу өгөх', en: 'We respond fast' },
  },
};

/**
 * TrustBadges - Conversion trust elements
 *
 * Displays trust/security badges to increase conversion confidence.
 * Configurable badges and variants for different page contexts.
 *
 * @example
 * <TrustBadges variant="compact" />
 * <TrustBadges variant="minimal" showFreeShipping showSupport />
 */
export default function TrustBadges({
  variant = 'default',
  className = '',
  showSecurePayment = true,
  showFreeShipping = true,
  showQualityGuarantee = true,
  showSupport = true,
}: TrustBadgesProps) {
  const { language } = useTheme();

  const activeBadges = [
    showSecurePayment && badges.securePayment,
    showFreeShipping && badges.freeShipping,
    showQualityGuarantee && badges.qualityGuarantee,
    showSupport && badges.support,
  ].filter(Boolean) as Badge[];

  if (activeBadges.length === 0) return null;

  // Minimal variant - icons only
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {activeBadges.map((badge, index) => {
          const Icon = badge.icon;
          return (
            <div
              key={index}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary"
              title={language === 'mn' ? badge.label.mn : badge.label.en}
            >
              <Icon size={16} />
            </div>
          );
        })}
      </div>
    );
  }

  // Compact variant - icon + label
  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center gap-4 ${className}`}>
        {activeBadges.map((badge, index) => {
          const Icon = badge.icon;
          return (
            <div key={index} className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <Icon size={16} />
              </div>
              <span className="text-xs font-medium text-foreground">
                {language === 'mn' ? badge.label.mn : badge.label.en}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Default variant - full badge with icon, label, and sublabel
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {activeBadges.map((badge, index) => {
        const Icon = badge.icon;
        return (
          <div
            key={index}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">
                {language === 'mn' ? badge.label.mn : badge.label.en}
              </p>
              {badge.sublabel && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'mn' ? badge.sublabel.mn : badge.sublabel.en}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

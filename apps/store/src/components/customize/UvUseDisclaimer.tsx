import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * UV Use Disclaimer Component
 * Warns users that UV products are for hard surfaces only, not fabric
 */
export function UvUseDisclaimer() {
  const { language } = useTheme();

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={24} />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
            {language === 'mn'
              ? '⚠️ UV хэвлэл - Хатуу гадаргууд зориулагдсан'
              : '⚠️ UV Printing - For Hard Surfaces Only'}
          </h3>
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
            {language === 'mn'
              ? 'Энэ бүтээгдэхүүн нь ХАТУУ ГАДАРГУУ (мод, шил, хуванцар, металл) дээр хэвлэхэд зориулагдсан. Даавуун материал дээр ашиглаж БОЛОХГҮЙ.'
              : 'This product is designed for printing on HARD SURFACES (wood, glass, plastic, metal). NOT suitable for fabric materials.'}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Suitable for */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
                <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                  {language === 'mn' ? 'Тохиромжтой:' : 'Suitable for:'}
                </span>
              </div>
              <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
                <li>• {language === 'mn' ? 'Утасны хуванцар' : 'Phone cases'}</li>
                <li>• {language === 'mn' ? 'Мод хавтан' : 'Wood boards'}</li>
                <li>• {language === 'mn' ? 'Шилэн аяга' : 'Glass cups'}</li>
                <li>• {language === 'mn' ? 'Металл хайрцаг' : 'Metal boxes'}</li>
                <li>• {language === 'mn' ? 'Хуванцар бараа' : 'Plastic items'}</li>
              </ul>
            </div>

            {/* NOT suitable for */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={16} className="text-red-600 dark:text-red-400" />
                <span className="text-sm font-semibold text-red-900 dark:text-red-100">
                  {language === 'mn' ? 'Тохироомжгүй:' : 'NOT suitable for:'}
                </span>
              </div>
              <ul className="text-xs text-red-800 dark:text-red-200 space-y-1">
                <li>• {language === 'mn' ? 'Цамц (T-shirt)' : 'T-shirts'}</li>
                <li>• {language === 'mn' ? 'Худи (Hoodie)' : 'Hoodies'}</li>
                <li>• {language === 'mn' ? 'Даавуун уут' : 'Fabric bags'}</li>
                <li>• {language === 'mn' ? 'Гутал' : 'Shoes'}</li>
                <li>• {language === 'mn' ? 'Бүх даавуу' : 'Any fabric'}</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
            {language === 'mn'
              ? '💡 Даавуун материал дээр хэвлэх бол DTF (Direct-to-Film) бүтээгдэхүүн сонгоно уу.'
              : '💡 For fabric printing, please choose DTF (Direct-to-Film) products instead.'}
          </p>
        </div>
      </div>
    </div>
  );
}

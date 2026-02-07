import { useMemo, useState } from 'react';
import { FileText, Info, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

type ProductTabsProps = {
  details?: unknown;
};

type TabId = 'description' | 'details' | 'care';

type Tab = {
  id: TabId;
  label: string;
  icon: typeof FileText;
};

export default function ProductTabs({ details }: ProductTabsProps) {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('description');

  const tabs: Tab[] = useMemo(
    () => [
      {
        id: 'description',
        label: language === 'mn' ? 'Тайлбар' : 'Description',
        icon: FileText,
      },
      {
        id: 'details',
        label: language === 'mn' ? 'Дэлгэрэнгүй' : 'Details',
        icon: Info,
      },
      {
        id: 'care',
        label: language === 'mn' ? 'Арчилгааны заавар' : 'Care Guide',
        icon: Sparkles,
      },
    ],
    [language]
  );

  const content: Record<TabId, string | string[]> = {
    description:
      language === 'mn'
        ? 'Энэ загвар нь өдөр тутмын хэрэглээнд эвтэйхэн, хөнгөн мэдрэмжтэй бөгөөд амьсгалах чадвартай материалтай.'
        : 'Designed for everyday comfort with lightweight support and breathable materials.',
    details:
      language === 'mn'
        ? [
            'Орчин үеийн минимал загвар',
            'Зөөлөн доторлогоотой тул удаан өмсөхөд эвтэйхэн',
            'Өдөр тутмын болон спорт хэв маягт зохицно',
            'Материалын боловсруулалт сайтай, цэвэрхэн өнгөлгөөтэй',
          ]
        : [
            'Modern minimal silhouette',
            'Comfortable inner cushioning for all-day wear',
            'Works for both casual and active styling',
            'Clean material finish with premium detailing',
          ],
    care:
      language === 'mn'
        ? [
            'Зөөлөн алчуураар тогтмол арчиж цэвэрлэнэ',
            'Шууд өндөр халуунд хатаахгүй байх',
            'Хуурай, агаар сэлгэлттэй орчинд хадгална',
            'Өнгө алдахаас сэргийлж нарны шууд тусгалаас хол байлгана',
          ]
        : [
            'Wipe gently with a soft cloth',
            'Avoid direct high-heat drying',
            'Store in a cool, dry, ventilated area',
            'Keep away from long direct sunlight exposure',
          ],
  };

  const listItems = activeTab === 'description' ? [] : (content[activeTab] as string[]);

  return (
    <div className="mt-12">
      <div className="border-b border-border mb-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'shrink-0 whitespace-nowrap flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 transition-colors font-semibold text-sm',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <tab.icon
                size={16}
                className={activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}
              />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-card rounded-2xl border border-border">
        {activeTab === 'description' && (
          <p className="leading-relaxed text-muted-foreground">{content.description}</p>
        )}

        {(activeTab === 'details' || activeTab === 'care') && (
          <ul className="space-y-3">
            {listItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-muted-foreground text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-0.5 flex-shrink-0">
                  <Info size={12} />
                </div>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { FileText, Info, Sparkles } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<TabId>('description');

  const tabs: Tab[] = [
    { id: 'description', label: 'Тайлбар', icon: FileText },
    { id: 'details', label: 'Дэлгэрэнгүй', icon: Info },
    { id: 'care', label: 'Арчилгааны заавар', icon: Sparkles },
  ];

  const content: Record<TabId, string | string[]> = {
    description:
      'Манай Сонгодог хар хөх пиджакаар өөрийн ажлын хувцасны цуглуулгыг баяжуулаарай. Дээд зэргийн ноосон холимог даавуугаар хийгдсэн энэхүү олон талт хувцас нь цаг үеийн уламжлалт дэгжин байдал, орчин үеийн өдлөг хослуулсан.',
    details: [
      'Орчин үеийн дүр төрхийн тулд нарийхан биеийн хэлбэрийн загвар',
      'Гараар оёсон нарийвчилсан дэлгэрэнгүй зүсэлттэй хацар',
      'Урд талын хоёр товчтой',
      'Ажиллах товчны нүхтэй функциональ ханцуйн товчнууд',
      'Дотоод цээж, хажуугийн халаас',
    ],
    care: [
      'Хамгийн сайн үр дүнд хүрэхийн тулд зөвхөн хуурай цэвэрлэгээ хийнэ',
      'Шаардлагатай бол бага дулаанаар уураар индүүдэх',
      'Хэлбэийг хадгалахын тулд дэвсгэртэй өлгүүрт хадгална',
      'Шууд нарны гэрлд удаан хугацаагаар байлгахаас зайлсхийх',
    ],
  };

  const listItems = activeTab === 'description' ? [] : (content[activeTab] as string[]);

  return (
    <div className="mt-12">
      {/* Tabs */}
      <div className="flex border-b border-border mb-6 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-2 px-5 py-3 border-b-2 transition-colors font-semibold text-sm',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content (FIXED for dark mode) */}
      <div className="p-6 bg-card rounded-2xl border border-border">
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

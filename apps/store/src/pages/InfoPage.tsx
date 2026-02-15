import { Link, useParams } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';

type InfoDef = {
  title: { mn: string; en: string };
  bullets: { mn: string[]; en: string[] };
};

const pages: Record<string, InfoDef> = {
  faq: {
    title: { mn: 'Түгээмэл асуултууд', en: 'FAQ' },
    bullets: {
      mn: [
        'Файл форматын зөвлөмж',
        'Хэмжээ сонголт',
        'Хүргэлтийн хугацаа',
        'Чанарын шалгалт ба анхааруулга',
      ],
      en: [
        'File format guidance',
        'Size selection',
        'Shipping timeline',
        'Quality checks and warnings',
      ],
    },
  },
  shipping: {
    title: { mn: 'Хүргэлт ба авах', en: 'Shipping & Pickup' },
    bullets: {
      mn: ['Хот дотор хүргэлт', 'Орон нутгийн тээвэр', 'Өөрөө авах боломж'],
      en: ['Local delivery', 'Nationwide shipping', 'Pickup options'],
    },
  },
  'art-requirements': {
    title: { mn: 'Файл шаардлага', en: 'Artwork Requirements' },
    bullets: {
      mn: ['Давхарга ба background', 'Хэмжээ ба нягтрал', 'Фонт, вектор файл'],
      en: ['Layers and background', 'Dimensions and resolution', 'Fonts and vector files'],
    },
  },
};

export default function InfoPage() {
  const { slug } = useParams();
  const { language } = useTheme();

  const key = (slug || '').trim();
  const def = key ? pages[key] : null;

  const title = def
    ? language === 'mn'
      ? def.title.mn
      : def.title.en
    : language === 'mn'
      ? 'Мэдээлэл'
      : 'Info';

  const bullets = def
    ? language === 'mn'
      ? def.bullets.mn
      : def.bullets.en
    : language === 'mn'
      ? ['Энэ хуудсыг дараа нь бодит контентоор бөглөнө.']
      : ['This page will be filled with real content later.'];

  return (
    <div className="pt-28 pb-16">
      <div className="container mx-auto px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {language === 'mn'
                ? 'Энд нийтлэг мэдээлэл, заавар, бодлогын хуудас байрлана.'
                : 'Guides, policies, and help pages live here.'}
            </p>
          </div>
          <Link
            to="/start-order"
            className="hidden sm:inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
          >
            {language === 'mn' ? '← Буцах' : '← Back'}
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <ul className="list-disc pl-6 space-y-2 text-sm">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/pages/faq"
              className="inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
            >
              {language === 'mn' ? 'FAQ' : 'FAQ'}
            </Link>
            <Link
              to="/pages/shipping"
              className="inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
            >
              {language === 'mn' ? 'Хүргэлт' : 'Shipping'}
            </Link>
            <Link
              to="/pages/art-requirements"
              className="inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
            >
              {language === 'mn' ? 'Файл шаардлага' : 'Artwork'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

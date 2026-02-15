import { Link } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { startOrderCards } from '@/lib/navigation';

export default function StartOrderPage() {
  const { language } = useTheme();

  return (
    <div className="pt-28 pb-16">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {language === 'mn' ? 'Захиалга эхлүүлэх' : 'Start an Order'}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {language === 'mn'
              ? 'Хийх ажлаа сонгоод дараагийн алхам руу орно.'
              : 'Choose a flow and continue to the next step.'}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {startOrderCards.map((card) => (
            <Link
              key={card.href}
              to={card.href}
              className="group rounded-2xl border border-border bg-card p-5 hover:shadow-xl hover:shadow-primary/10 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold group-hover:text-primary transition-colors">
                    {language === 'mn' ? card.label.mn : card.label.en}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {language === 'mn' ? card.description?.mn : card.description?.en}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-muted/20 p-5">
          <p className="text-sm text-muted-foreground">
            {language === 'mn' ? 'Эсвэл бүх бүтээгдэхүүнээ харах:' : 'Or browse the full catalog:'}
          </p>
          <div className="mt-3">
            <Link
              to="/products"
              className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {language === 'mn' ? 'Бүгдийг үзэх' : 'View All Products'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

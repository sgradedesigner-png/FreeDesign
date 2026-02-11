// src/components/layout/FilterSidebar.tsx
import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { ChevronDown, Check, Filter } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useCategoriesQuery } from '../../data/categories.queries'; // âœ… Categories query

type Filters = {
  priceRange: [number, number];
  sizes: string[];
  categories: string[];
};

type OpenSections = {
  categories: boolean;
  price: boolean;
  sizes: boolean;
};

type FilterSidebarProps = {
  onFilterChange: (filters: Filters) => void;
  maxPrice?: number;
  activeCategories?: string[];
};

const formatMNT = (value: number) =>
  `${new Intl.NumberFormat('mn-MN').format(Math.max(0, Math.round(value)))} ₮`;

const normalizeCategoryValue = (value: string) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

export default function FilterSidebar({
  onFilterChange,
  maxPrice = 2000,
  activeCategories = [],
}: FilterSidebarProps) {
  const { language } = useTheme();
  const sliderMax = Math.max(
    1000,
    Math.ceil((Number.isFinite(maxPrice) ? maxPrice : 2000) / 1000) * 1000
  );
  const [priceRange, setPriceRange] = useState<[number, number]>([0, sliderMax]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const normalizedActiveCategories = useMemo(
    () =>
      activeCategories
        .map((category) => normalizeCategoryValue(category))
        .filter((category): category is string => Boolean(category)),
    [activeCategories]
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(normalizedActiveCategories);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const [openSections, setOpenSections] = useState<OpenSections>({
    categories: true,
    price: true,
    sizes: true
  });

  // âœ… Fetch categories from database
  const { data: categoriesData = [] } = useCategoriesQuery();

  const normalizePriceRange = (minValue: number, maxValue: number): [number, number] => {
    const safeMin = Number.isFinite(minValue) ? minValue : 0;
    const safeMax = Number.isFinite(maxValue) ? maxValue : sliderMax;

    let nextMin = Math.max(0, Math.round(safeMin));
    let nextMax = Math.min(sliderMax, Math.max(0, Math.round(safeMax)));

    if (nextMin > sliderMax) nextMin = sliderMax;
    if (nextMin > nextMax) [nextMin, nextMax] = [nextMax, nextMin];

    return [nextMin, nextMax];
  };

  useEffect(() => {
    setPriceRange((prev) => {
      const [nextMin] = normalizePriceRange(prev[0], prev[1]);
      if (prev[0] === nextMin && prev[1] === sliderMax) return prev;
      return [nextMin, sliderMax];
    });
  }, [sliderMax]);

  useEffect(() => {
    setSelectedCategories((prev) => {
      const hasSameSelection =
        prev.length === normalizedActiveCategories.length &&
        prev.every((category, index) => category === normalizedActiveCategories[index]);
      if (hasSameSelection) return prev;
      return normalizedActiveCategories;
    });
  }, [normalizedActiveCategories]);

  // âœ… ÐžÑ€Ñ‡ÑƒÑƒÐ»Ð³Ñ‹Ð½ Ð¾Ð±ÑŠÐµÐºÑ‚
  const t = {
    title: language === 'mn' ? '\u0428\u04AF\u04AF\u043B\u0442\u04AF\u04AF\u0440' : 'Filters',
    categories: language === 'mn' ? '\u0410\u043D\u0433\u0438\u043B\u0430\u043B' : 'Categories',
    price: language === 'mn' ? '\u04AE\u043D\u0438\u0439\u043D \u0445\u044F\u0437\u0433\u0430\u0430\u0440' : 'Price Range',
    sizes: language === 'mn' ? '\u0425\u044D\u043C\u0436\u044D\u044D' : 'Sizes',
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onFilterChange({
        priceRange,
        sizes: selectedSizes,
        categories: selectedCategories
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [priceRange, selectedSizes, selectedCategories, onFilterChange]);

  // Use category slug for stable filtering key.
  const categories = categoriesData.map(cat => ({
    name: cat.name,
    id: normalizeCategoryValue(cat.slug || cat.id),
  }));

  const sizeGroups = [
    ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    ['30', '32', '34'],
    ['39', '40', '41', '42', '43'],
    ['One Size']
  ];

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => 
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleSection = (section: keyof OpenSections) => {
    setOpenSections(prev => ({...prev, [section]: !prev[section]}));
  };

  const handleMinPrice = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value)) return;
    setPriceRange(normalizePriceRange(value, priceRange[1]));
  };

  const handleMaxPrice = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value)) return;
    setPriceRange(normalizePriceRange(priceRange[0], value));
  };

  return (
    <aside className="w-full lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-24 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2 lg:scrollbar-hide lg:pb-10 mb-6 lg:mb-0">
      
      <button
        type="button"
        onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
        className="w-full flex items-center justify-between mb-4 lg:mb-6 text-foreground"
        aria-expanded={isMobileFiltersOpen}
        aria-controls="catalog-filters-panel"
      >
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Filter size={20} />
          </div>
          <h2 className="text-xl font-heading font-bold">{t.title}</h2>
        </div>
        <ChevronDown
          size={18}
          className={`lg:hidden text-muted-foreground transition-transform duration-300 ${
            isMobileFiltersOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        id="catalog-filters-panel"
        className={`overflow-hidden transition-all duration-300 lg:overflow-visible ${
          isMobileFiltersOpen
            ? 'max-h-[2200px] opacity-100'
            : 'max-h-0 opacity-0 pointer-events-none lg:pointer-events-auto'
        } lg:max-h-none lg:opacity-100`}
      >
      <div className="space-y-6">
        
        {/* 1. ÐÐ½Ð³Ð¸Ð»Ð°Ð» (Categories) */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <button 
                onClick={() => toggleSection('categories')}
                className="w-full flex items-center justify-between font-bold text-foreground mb-4 group"
            >
                <span className="text-lg">{t.categories}</span> {/* âœ… ÐžÑ€Ñ‡ÑƒÑƒÐ»Ð³Ð° */}
                <ChevronDown size={18} className={`text-muted-foreground transition-transform duration-300 group-hover:text-primary ${openSections.categories ? 'rotate-180' : ''}`} />
            </button>
            
            <div className={`space-y-2 overflow-hidden transition-all duration-500 ease-in-out ${openSections.categories ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {categories.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                        <div 
                            key={cat.id} 
                            onClick={() => toggleCategory(cat.id)}
                            className={`
                                group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 border
                                ${isSelected 
                                    ? 'bg-primary/10 border-primary/20 translate-x-1' 
                                    : 'bg-transparent border-transparent hover:bg-muted/50 hover:border-border'
                                }
                            `}
                        >
                            <div className={`
                                w-5 h-5 rounded-md flex items-center justify-center transition-all duration-300 shadow-sm border
                                ${isSelected 
                                    ? 'bg-primary border-primary scale-110' 
                                    : 'bg-card border-slate-400 dark:border-slate-600 group-hover:border-primary/50'}
                            `}>
                                <Check size={12} className={`text-white transition-all duration-200 ${isSelected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} strokeWidth={4} />
                            </div>
                            
                            <span className={`text-sm font-medium transition-colors ${isSelected ? 'text-primary' : 'text-slate-600 dark:text-slate-300 group-hover:text-foreground'}`}>
                                {cat.name} {/* âœ… Ð¥ÑÐ»Ð½ÑÑÑ Ñ…Ð°Ð¼Ð°Ð°Ñ€ÑÐ°Ð½ Ð½ÑÑ€ */}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* 2. Ò®Ð½Ð¸Ð¹Ð½ Ñ…ÑÐ·Ð³Ð°Ð°Ñ€ (Price Range) */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
             <button 
                onClick={() => toggleSection('price')}
                className="w-full flex items-center justify-between font-bold text-foreground mb-6 group"
            >
                <span className="text-lg">{t.price}</span> {/* âœ… ÐžÑ€Ñ‡ÑƒÑƒÐ»Ð³Ð° */}
                <ChevronDown size={18} className={`text-muted-foreground transition-transform duration-300 group-hover:text-primary ${openSections.price ? 'rotate-180' : ''}`} />
             </button>
             
             <div className={`transition-all duration-500 ease-in-out ${openSections.price ? 'max-h-[280px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                 <div className="grid grid-cols-2 gap-3 mb-4">
                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">Min</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={sliderMax}
                        value={priceRange[0]}
                        onChange={handleMinPrice}
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground shadow-sm"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">Max</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={sliderMax}
                        value={priceRange[1]}
                        onChange={handleMaxPrice}
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground shadow-sm"
                      />
                    </label>
                 </div>

                 <div className="mb-4 flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>{formatMNT(priceRange[0])}</span>
                    <span>{formatMNT(priceRange[1])}</span>
                 </div>

                 <div className="relative h-1.5 rounded-full bg-muted/80 mx-1">
                    <div
                        className="absolute h-full bg-primary rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        style={{
                            left: `${(priceRange[0] / sliderMax) * 100}%`,
                            right: `${100 - (priceRange[1] / sliderMax) * 100}%`
                        }}
                    ></div>

                    <input type="range" min="0" max={sliderMax} value={priceRange[0]} onChange={handleMinPrice} className="dual-range-slider absolute w-full h-full opacity-0 z-20 appearance-none" />
                    <input type="range" min="0" max={sliderMax} value={priceRange[1]} onChange={handleMaxPrice} className="dual-range-slider absolute w-full h-full opacity-0 z-20 appearance-none" />

                    <div className="absolute w-5 h-5 bg-background border-[3px] border-primary rounded-full shadow-md top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10" style={{ left: `${(priceRange[0] / sliderMax) * 100}%` }}></div>
                    <div className="absolute w-5 h-5 bg-background border-[3px] border-primary rounded-full shadow-md top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10" style={{ left: `${(priceRange[1] / sliderMax) * 100}%` }}></div>
                 </div>

                 <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{'0 ₮'}</span>
                    <span>Max: {formatMNT(sliderMax)}</span>
                 </div>
             </div>
        </div>

        {/* 3. Ð¥ÑÐ¼Ð¶ÑÑ (Sizes) */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <button 
                onClick={() => toggleSection('sizes')}
                className="w-full flex items-center justify-between font-bold text-foreground mb-4 group"
            >
                <span className="text-lg">{t.sizes}</span> {/* âœ… ÐžÑ€Ñ‡ÑƒÑƒÐ»Ð³Ð° */}
                <ChevronDown size={18} className={`text-muted-foreground transition-transform duration-300 group-hover:text-primary ${openSections.sizes ? 'rotate-180' : ''}`} />
            </button>
            
            <div className={`transition-all duration-500 ease-in-out ${openSections.sizes ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                {sizeGroups.map((group, groupIndex) => (
                    <div key={groupIndex}>
                        <div className="flex flex-wrap gap-2">
                            {group.map(size => {
                                const isSelected = selectedSizes.includes(size);
                                return (
                                    <button 
                                        key={size} 
                                        onClick={() => toggleSize(size)}
                                        className={`
                                            relative px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 border
                                            ${isSelected
                                            ? 'bg-primary text-white border-primary shadow-[0_4px_12px_rgba(16,185,129,0.3)] scale-105'
                                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:border-primary/50 hover:-translate-y-0.5'
                                            }
                                        `}
                                    >
                                        {size}
                                        {isSelected && <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full"></span>}
                                    </button>
                                )
                            })}
                        </div>
                        {groupIndex < sizeGroups.length - 1 && <div className="h-px bg-border/60 my-4 w-full"></div>}
                    </div>
                ))}
            </div>
        </div>

      </div>
      </div>
    </aside>
  );
}


// src/components/layout/FilterSidebar.tsx
import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { ChevronDown, Check, Filter } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useCategoriesQuery } from '../../data/categories.queries'; // ✅ Categories query

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
};

export default function FilterSidebar({ onFilterChange }: FilterSidebarProps) {
  const { language } = useTheme();
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]); // ✅ 500 → 2000
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [openSections, setOpenSections] = useState<OpenSections>({
    categories: true,
    price: true,
    sizes: true
  });

  // ✅ Fetch categories from database
  const { data: categoriesData = [] } = useCategoriesQuery();

  // ✅ Орчуулгын объект
  const t = {
    title: language === 'mn' ? 'Шүүлтүүр' : 'Filters',
    categories: language === 'mn' ? 'Ангилал' : 'Categories',
    price: language === 'mn' ? 'Үнийн хязгаар' : 'Price Range',
    sizes: language === 'mn' ? 'Хэмжээ' : 'Sizes',
  };

  useEffect(() => {
    onFilterChange({
      priceRange,
      sizes: selectedSizes,
      categories: selectedCategories
    });
  }, [priceRange, selectedSizes, selectedCategories, onFilterChange]);

  // ✅ Use categories from database
  const categories = categoriesData.map(cat => ({
    name: cat.name,
    id: cat.name, // Use name for filtering (matches product.category)
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
    const val = Math.min(Number(e.target.value), priceRange[1] - 10);
    setPriceRange([val, priceRange[1]]);
  };

  const handleMaxPrice = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), priceRange[0] + 10);
    setPriceRange([priceRange[0], val]);
  };

  return (
    <aside className="w-72 flex-shrink-0 hidden lg:block sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto pr-2 scrollbar-hide pb-10">
      
      <div className="flex items-center gap-2 mb-6 text-foreground">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Filter size={20} />
        </div>
        <h2 className="text-xl font-heading font-bold">{t.title}</h2> {/* ✅ Орчуулга */}
      </div>

      <div className="space-y-6">
        
        {/* 1. Ангилал (Categories) */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <button 
                onClick={() => toggleSection('categories')}
                className="w-full flex items-center justify-between font-bold text-foreground mb-4 group"
            >
                <span className="text-lg">{t.categories}</span> {/* ✅ Орчуулга */}
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
                                {cat.name} {/* ✅ Хэлнээс хамаарсан нэр */}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* 2. Үнийн хязгаар (Price Range) */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
             <button 
                onClick={() => toggleSection('price')}
                className="w-full flex items-center justify-between font-bold text-foreground mb-6 group"
            >
                <span className="text-lg">{t.price}</span> {/* ✅ Орчуулга */}
                <ChevronDown size={18} className={`text-muted-foreground transition-transform duration-300 group-hover:text-primary ${openSections.price ? 'rotate-180' : ''}`} />
             </button>
             
             <div className={`transition-all duration-500 ease-in-out ${openSections.price ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                 <div className="flex items-center justify-between mb-6">
                    <div className="px-3 py-1.5 bg-muted rounded-lg text-sm font-bold text-foreground border border-border min-w-[70px] text-center shadow-sm">
                        ${priceRange[0]}
                    </div>
                    <div className="h-[2px] w-4 bg-border"></div>
                    <div className="px-3 py-1.5 bg-muted rounded-lg text-sm font-bold text-foreground border border-border min-w-[70px] text-center shadow-sm">
                        ${priceRange[1]}
                    </div>
                 </div>
                 
                 <div className="relative h-1.5 rounded-full bg-muted/80 mx-1">
                    <div
                        className="absolute h-full bg-primary rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        style={{
                            left: `${(priceRange[0] / 2000) * 100}%`,
                            right: `${100 - (priceRange[1] / 2000) * 100}%`
                        }}
                    ></div>

                    <input type="range" min="0" max="2000" value={priceRange[0]} onChange={handleMinPrice} className="dual-range-slider absolute w-full h-full opacity-0 z-20 appearance-none" />
                    <input type="range" min="0" max="2000" value={priceRange[1]} onChange={handleMaxPrice} className="dual-range-slider absolute w-full h-full opacity-0 z-20 appearance-none" />

                    <div className="absolute w-5 h-5 bg-background border-[3px] border-primary rounded-full shadow-md top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10" style={{ left: `${(priceRange[0] / 2000) * 100}%` }}></div>
                    <div className="absolute w-5 h-5 bg-background border-[3px] border-primary rounded-full shadow-md top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-10" style={{ left: `${(priceRange[1] / 2000) * 100}%` }}></div>
                 </div>
             </div>
        </div>

        {/* 3. Хэмжээ (Sizes) */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <button 
                onClick={() => toggleSection('sizes')}
                className="w-full flex items-center justify-between font-bold text-foreground mb-4 group"
            >
                <span className="text-lg">{t.sizes}</span> {/* ✅ Орчуулга */}
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
    </aside>
  );
}
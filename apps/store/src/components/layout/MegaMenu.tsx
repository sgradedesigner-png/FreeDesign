import { Link } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { megaMenuConfig } from '@/lib/navigation';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function MegaMenu() {
  const { language } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close menu on route change
  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Desktop Trigger */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className="hidden lg:flex items-center gap-1 px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {language === 'mn' ? 'Каталог' : 'Products'}
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Mega Menu Dropdown */}
      {isOpen && (
        <div
          ref={menuRef}
          onMouseLeave={() => setIsOpen(false)}
          className="absolute left-0 top-full mt-2 w-screen max-w-5xl z-50 bg-card border border-border rounded-2xl shadow-2xl p-8"
          style={{ minWidth: '800px' }}
        >
          <div className="grid grid-cols-4 gap-8">
            {megaMenuConfig.map((group, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide">
                  {language === 'mn' ? group.title.mn : group.title.en}
                </h3>
                <ul className="space-y-3">
                  {group.items.map((item, itemIdx) => (
                    <li key={itemIdx}>
                      <Link
                        to={item.href}
                        onClick={handleLinkClick}
                        className="group block"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                {language === 'mn' ? item.label.mn : item.label.en}
                              </span>
                              {item.badge && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/70 transition-colors">
                                {language === 'mn'
                                  ? item.description.mn
                                  : item.description.en}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {language === 'mn' ? 'Эргэлзэж байна уу?' : 'Not sure where to start?'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === 'mn'
                    ? 'Захиалгын төрлөө сонгоно уу'
                    : 'Choose your order type to get started'}
                </p>
              </div>
              <Link
                to="/start-order"
                onClick={handleLinkClick}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
              >
                {language === 'mn' ? 'Захиалга эхлүүлэх' : 'Start Order'} →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mobile version for drawer/sidebar
export function MegaMenuMobile({ onClose }: { onClose?: () => void }) {
  const { language } = useTheme();
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="py-4">
      {megaMenuConfig.map((group, idx) => (
        <div key={idx} className="mb-4">
          <button
            onClick={() => setExpandedGroup(expandedGroup === idx ? null : idx)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            {language === 'mn' ? group.title.mn : group.title.en}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedGroup === idx ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedGroup === idx && (
            <ul className="mt-2 space-y-1 pl-4">
              {group.items.map((item, itemIdx) => (
                <li key={itemIdx}>
                  <Link
                    to={item.href}
                    onClick={handleLinkClick}
                    className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>{language === 'mn' ? item.label.mn : item.label.en}</span>
                      {item.badge && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === 'mn' ? item.description.mn : item.description.en}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Mobile CTA */}
      <div className="mt-6 px-4">
        <Link
          to="/start-order"
          onClick={handleLinkClick}
          className="block w-full text-center px-4 py-3 text-sm font-semibold bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
        >
          {language === 'mn' ? 'Захиалга эхлүүлэх' : 'Start Order'} →
        </Link>
      </div>
    </div>
  );
}

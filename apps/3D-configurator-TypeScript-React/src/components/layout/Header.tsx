// src/components/layout/Header.tsx
import { Moon, Sun, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme, useLanguage, useUIActions } from '@/stores';

export function Header() {
  const theme = useTheme();
  const language = useLanguage();
  const { toggleTheme, setLanguage } = useUIActions();

  const handleLanguageToggle = () => {
    setLanguage(language === 'en' ? 'mn' : 'en');
  };

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b bg-card">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">
          {language === 'mn' ? '3D Тохируулагч' : '3D Configurator'}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLanguageToggle}
              >
                <Languages className="h-5 w-5" />
                <span className="sr-only">Toggle language</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{language === 'mn' ? 'English' : 'Монгол'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === 'light' ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {theme === 'light'
                  ? language === 'mn'
                    ? 'Харанхуй горим'
                    : 'Dark mode'
                  : language === 'mn'
                    ? 'Гэрэлтэй горим'
                    : 'Light mode'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}

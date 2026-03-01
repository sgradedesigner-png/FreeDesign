import React from 'react';
import {
  ShoppingBag,
  Sparkles,
  Layers,
  Info,
  Search,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  Check,
  Star,
  Minus,
  Plus,
  Truck,
  RotateCw,
  ShieldCheck,
  ThumbsUp,
  Heart,
  CircleUser,
  LogOut,
} from 'lucide-react';

const icons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ShoppingBagIcon: ShoppingBag,
  SparklesIcon: Sparkles,
  RectangleStackIcon: Layers,
  InformationCircleIcon: Info,
  MagnifyingGlassIcon: Search,
  MoonIcon: Moon,
  SunIcon: Sun,
  Bars3Icon: Menu,
  XMarkIcon: X,
  ChevronDownIcon: ChevronDown,
  CheckIcon: Check,
  StarIcon: Star,
  MinusIcon: Minus,
  PlusIcon: Plus,
  TruckIcon: Truck,
  ArrowPathIcon: RotateCw,
  ShieldCheckIcon: ShieldCheck,
  HandThumbUpIcon: ThumbsUp,
  HeartIcon: Heart,
  UserCircleIcon: CircleUser,
  ArrowRightOnRectangleIcon: LogOut,
};

export type IconName = string;

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

export default function Icon({ name, size = 24, className = '' }: IconProps) {
  const LucideIcon = icons[name] ?? icons.ShoppingBagIcon;
  return <LucideIcon size={size} className={className} />;
}

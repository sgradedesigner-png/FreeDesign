import React from 'react';
import {
  ShoppingBag, Sparkles, Layers, Info, Search, // ✅ RectangleStack -> Layers болгов
  Moon, Sun, Menu, X, ChevronDown, Check, Star,
  Minus, Plus, Truck, RotateCw, ShieldCheck, ThumbsUp
} from 'lucide-react';

const icons = {
  ShoppingBagIcon: ShoppingBag,
  SparklesIcon: Sparkles,
  RectangleStackIcon: Layers, // ✅ Энд бас Layers болгож солино (Түлхүүр үг нь хэвээрээ байна)
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
  HandThumbUpIcon: ThumbsUp
};

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

export default function Icon({ name, size = 24, className = '' }: IconProps) {
  // Хэрэв нэр буруу орж ирвэл алдаа гаргахгүйн тулд default icon ашиглана
  const LucideIcon = icons[name] || icons.ShoppingBagIcon;
  return <LucideIcon size={size} className={className} />;
}

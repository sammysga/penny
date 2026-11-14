import {
  Award, BarChart3, Bell, CalendarCheck, Car, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Coffee, CreditCard, Download,
  Gift, HeartPulse, Home, Landmark, LayoutGrid, LineChart, Menu, Moon, MoreHorizontal, PawPrint, Pencil, PiggyBank, Plane, Plus,
  Receipt, Repeat, Search, Settings, ShieldCheck, ShoppingBag, Sparkles, Star, Sun, Target, Trash2, Trophy, Undo2, Upload, Users,
  Wallet, X, ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Clock, AlertCircle, CheckCircle2, Info, Heart, Lock, Unlock, ExternalLink,
  Flame, PanelLeftClose, PanelLeftOpen, RotateCcw, Scale, CalendarDays, TrendingUp, TrendingDown, Coins, BellOff, Banknote, History,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

export const ICONS = {
  Award, BarChart3, Bell, CalendarCheck, Car, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Coffee, CreditCard, Download,
  Gift, HeartPulse, Home, Landmark, LayoutGrid, LineChart, Menu, Moon, MoreHorizontal, PawPrint, Pencil, PiggyBank, Plane, Plus,
  Receipt, Repeat, Search, Settings, ShieldCheck, ShoppingBag, Sparkles, Star, Sun, Target, Trash2, Trophy, Undo2, Upload, Users,
  Wallet, X, ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Clock, AlertCircle, CheckCircle2, Info, Heart, Lock, Unlock, ExternalLink,
  Flame, PanelLeftClose, PanelLeftOpen, RotateCcw, Scale, CalendarDays, TrendingUp, TrendingDown, Coins, BellOff, Banknote, History,
};
export type IconName = keyof typeof ICONS;

export function Icon({ name, ...p }: { name: string } & LucideProps) {
  const C = ICONS[name as IconName] ?? Circle;
  return <C strokeWidth={1.75} aria-hidden {...p} />;
}

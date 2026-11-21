import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Euro,
  Flag,
  Hand,
  Info,
  KeyRound,
  Lock,
  Minus,
  Moon,
  Monitor,
  Search,
  Settings,
  Sun,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../cn.ts";

/** The closed icon set of the design (DESIGN.md §5): each name is one meaning. */
const ICONS = {
  agent: Bot,
  check: Check,
  clock: Clock,
  dash: Minus,
  dot: Circle,
  down: ArrowDown,
  euro: Euro,
  external: ExternalLink,
  flag: Flag,
  hand: Hand,
  info: Info,
  key: KeyRound,
  lock: Lock,
  moon: Moon,
  monitor: Monitor,
  more: ChevronDown,
  next: ChevronRight,
  search: Search,
  settings: Settings,
  sun: Sun,
  up: ArrowUp,
  warn: TriangleAlert,
  close: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

type IconProps = { name: IconName; className?: string };

/** Decorative: the text beside an icon always says the same thing. An icon alone is an `IconButton`. */
export function Icon({ name, className }: IconProps) {
  const Component = ICONS[name];
  return <Component aria-hidden strokeWidth={1.75} className={cn("size-4 shrink-0", className)} />;
}

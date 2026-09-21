import {
  Book,
  Briefcase,
  Calendar,
  Camera,
  CircleHelp,
  Clock,
  Code,
  CreditCard,
  Download,
  FileText,
  Folder,
  Gift,
  Github,
  Globe,
  Heart,
  Home,
  Image,
  Info,
  LayoutGrid,
  Link,
  LogIn,
  Mail,
  Map,
  MessageSquare,
  Music,
  Newspaper,
  Package,
  Phone,
  Play,
  Rocket,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Trophy,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "../../../../api/_lib/spec";

/**
 * Every `IconName` the server may emit → its lucide component. The record is
 * typed against the contract, so adding a name to `ICON_NAMES` without a
 * mapping here fails `tsc`.
 */
export const ICONS: Record<IconName, LucideIcon> = {
  home: Home,
  tag: Tag,
  book: Book,
  newspaper: Newspaper,
  info: Info,
  mail: Mail,
  "log-in": LogIn,
  "layout-grid": LayoutGrid,
  star: Star,
  search: Search,
  settings: Settings,
  download: Download,
  users: Users,
  "message-square": MessageSquare,
  calendar: Calendar,
  image: Image,
  play: Play,
  "shopping-cart": ShoppingCart,
  "circle-help": CircleHelp,
  globe: Globe,
  code: Code,
  briefcase: Briefcase,
  heart: Heart,
  "file-text": FileText,
  rocket: Rocket,
  shield: Shield,
  "credit-card": CreditCard,
  github: Github,
  map: Map,
  phone: Phone,
  video: Video,
  music: Music,
  camera: Camera,
  package: Package,
  zap: Zap,
  trophy: Trophy,
  gift: Gift,
  clock: Clock,
  folder: Folder,
  link: Link,
};

/** The lucide export name for an icon, for generated code (`"log-in"` → `LogIn`). */
export function iconExportName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Tolerant lookup: unknown / missing names (a newer server, a typo) render a globe. */
export function iconFor(name: string | undefined): LucideIcon {
  return (name && (ICONS as Record<string, LucideIcon | undefined>)[name]) || Globe;
}

/** `true` when the client has a real glyph for the name (used when generating imports). */
export function isKnownIcon(name: string | undefined): name is IconName {
  return name !== undefined && Object.prototype.hasOwnProperty.call(ICONS, name);
}

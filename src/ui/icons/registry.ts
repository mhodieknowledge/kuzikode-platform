/**
 * The one icon system (docs/redesign/DESIGN_DIRECTION.md §7): Lucide, 1.75 stroke at 20 px, `currentColor`.
 * Components ask for an icon by meaning (`IconName`), never by Lucide export, so a meaning maps to one glyph everywhere.
 * CMS content stores the older names in `CMS_ICONS` (src/shared/icons.ts); `cmsIcon()` maps them, and division / industry slugs
 * get a more specific glyph through `divisionIcon()` / `industryIcon()`.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AppWindow,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  Banknote,
  Bell,
  Boxes,
  BrainCircuit,
  Briefcase,
  Building2,
  Calendar,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleX,
  Clock,
  Cloud,
  Command,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FolderKanban,
  Gauge,
  Globe,
  GraduationCap,
  HeartPulse,
  Hotel,
  Image,
  Inbox,
  Info,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  Newspaper,
  Package,
  PanelsTopLeft,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  ReceiptText,
  RefreshCw,
  Repeat,
  ScrollText,
  Search,
  Send,
  ServerCog,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  Terminal,
  Timer,
  Trash2,
  TriangleAlert,
  Truck,
  Upload,
  UserRound,
  Users,
  Wallet,
  Wheat,
  Wifi,
  WifiOff,
  Workflow,
  X,
} from 'lucide-react';
import type { CmsIcon } from '../../shared/icons';

export const ICONS = {
  // Navigation and movement
  menu: Menu,
  close: X,
  search: Search,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up-right': ArrowUpRight,
  external: ExternalLink,
  command: Command,
  // Contact channels
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
  location: MapPin,
  hours: Clock,
  // Actions
  download: Download,
  copy: Copy,
  pay: CreditCard,
  send: Send,
  add: Plus,
  remove: Minus,
  edit: Pencil,
  delete: Trash2,
  filter: Filter,
  sort: ArrowUpDown,
  refresh: RefreshCw,
  upload: Upload,
  calendar: Calendar,
  view: Eye,
  print: Printer,
  check: Check,
  // Status
  'status-ok': CircleCheck,
  'status-warn': TriangleAlert,
  'status-danger': CircleX,
  'status-info': Info,
  'status-pending': CircleDashed,
  help: CircleHelp,
  online: Wifi,
  offline: WifiOff,
  lock: Lock,
  key: KeyRound,
  // Money
  cash: Banknote,
  wallet: Wallet,
  receipt: Receipt,
  // Workspace
  overview: LayoutDashboard,
  projects: FolderKanban,
  quotations: FileText,
  invoices: ReceiptText,
  payments: Wallet,
  services: Layers,
  support: LifeBuoy,
  account: UserRound,
  notifications: Bell,
  'theme-dark': Moon,
  'theme-light': Sun,
  'sign-out': LogOut,
  terminal: Terminal,
  activity: Activity,
  // Admin modules
  enquiries: Inbox,
  leads: Target,
  clients: Building2,
  subscriptions: Repeat,
  'managed-services': ServerCog,
  expenses: Receipt,
  reports: ChartColumn,
  time: Timer,
  pages: PanelsTopLeft,
  packages: Package,
  content: Newspaper,
  media: Image,
  careers: Briefcase,
  users: Users,
  settings: Settings,
  audit: ScrollText,
  // Divisions (by meaning)
  'div-web': Globe,
  'div-apps': AppWindow,
  'div-software': Boxes,
  'div-ai': BrainCircuit,
  'div-automation': Workflow,
  'div-cloud': ServerCog,
  // Industries
  'ind-retail': ShoppingBag,
  'ind-finance': Landmark,
  'ind-education': GraduationCap,
  'ind-health': HeartPulse,
  'ind-ngo': Globe,
  'ind-hospitality': Hotel,
  'ind-agriculture': Wheat,
  'ind-logistics': Truck,
  // CMS vocabulary (src/shared/icons.ts)
  globe: Globe,
  smartphone: Smartphone,
  layers: Layers,
  sparkles: Sparkles,
  workflow: Workflow,
  cloud: Cloud,
  'bar-chart': ChartColumn,
  'line-chart': LineChart,
  gauge: Gauge,
  'list-checks': ListChecks,
  'shield-check': ShieldCheck,
  'life-buoy': LifeBuoy,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Pixel sizes and their stroke widths: 1.75 at 16–20 px, 1.5 at 24–32 px keeps the optical weight even. */
export const ICON_SIZES = { 16: 1.75, 20: 1.75, 24: 1.5, 32: 1.5 } as const;
export type IconSize = keyof typeof ICON_SIZES;

const DIVISIONS: Record<string, IconName> = {
  'web-development': 'div-web',
  'mobile-desktop-apps': 'div-apps',
  'business-software': 'div-software',
  'ai-data': 'div-ai',
  'automation-integration': 'div-automation',
  'cloud-it': 'div-cloud',
};

const INDUSTRIES: Record<string, IconName> = {
  'retail-wholesale': 'ind-retail',
  'financial-services': 'ind-finance',
  education: 'ind-education',
  healthcare: 'ind-health',
  'ngos-development': 'ind-ngo',
  'hospitality-tourism': 'ind-hospitality',
  agriculture: 'ind-agriculture',
  'logistics-transport': 'ind-logistics',
};

const isIconName = (name: string): name is IconName => Object.hasOwn(ICONS, name);

/** CMS icon names are a subset of the registry; anything unknown gets the neutral `layers` glyph. */
export function cmsIcon(name: CmsIcon | string | null | undefined): IconName {
  return name && isIconName(name) ? name : 'layers';
}

/** A division's icon by slug, falling back to the icon stored in the CMS. */
export function divisionIcon(slug: string, stored?: string | null): IconName {
  return DIVISIONS[slug] ?? cmsIcon(stored);
}

/** An industry's icon by slug, falling back to the icon stored in the CMS. */
export function industryIcon(slug: string, stored?: string | null): IconName {
  return INDUSTRIES[slug] ?? cmsIcon(stored);
}

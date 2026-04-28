/* ─────────────────────────────────────────────────────────────
   Modern Outline Icon Library
   Powered by Phosphor Icons (regular weight) for a clean,
   minimal, modern outlined feel. Keeps the same export names
   and signatures as prior iterations so callers don't break.
   ───────────────────────────────────────────────────────────── */

import {
  House,
  Wrench,
  FileText,
  Calendar,
  UsersThree,
  UsersFour,
  ChartPieSlice,
  CurrencyDollar,
  GridFour,
  GearSix,
  User,
  Lock,
  Bell,
  CaretUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  Sun,
  Moon,
  MagnifyingGlass,
  List,
  Plus,
  X,
  Check,
  PencilSimple,
  PaintBrush,
  Trash,
  ArrowsClockwise,
  PaperPlaneTilt,
  Copy,
  Key,
  Warning,
  ShieldCheck,
  Clock,
  Play,
  Pause,
  Stop,
  Eye,
  EyeSlash,
  EnvelopeSimple,
  Lightbulb,
  Book,
  Repeat,
  CheckCircle,
  WarningCircle,
  Info,
  DotsThree,
  Camera,
  Car,
  ThumbsUp,
  Sparkle,
  ArrowSquareOut,
  Notebook,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

export interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/**
 * Wrap a Phosphor icon into our internal IconProps signature.
 * Uses the "regular" weight for a clean, modern outlined feel.
 */
function wrap(PIcon: PhosphorIcon, defaultSize = 22) {
  return function WrappedIcon({ size = defaultSize, className, color }: IconProps) {
    return (
      <PIcon
        size={size}
        weight="regular"
        className={className}
        color={color || 'currentColor'}
      />
    );
  };
}

/* ── Navigation / Feature ──────────────────────────────── */
export const IconDashboard        = wrap(House);
export const IconWrench           = wrap(Wrench);
export const IconDocument         = wrap(FileText);
export const IconCalendar         = wrap(Calendar);
export const IconClients          = wrap(UsersThree);
export const IconTeam             = wrap(UsersFour);
export const IconAnalytics        = wrap(ChartPieSlice);
export const IconFinanceOverview  = wrap(CurrencyDollar);
export const IconApps             = wrap(GridFour);
export const IconSettings         = wrap(GearSix);
export const IconUser             = wrap(User);
export const IconLock             = wrap(Lock);
export const IconBell             = wrap(Bell);
export const IconGear             = wrap(GearSix, 18);

/* ── Directional ───────────────────────────────────────── */
export const IconChevronUp    = wrap(CaretUp, 16);
export const IconChevronDown  = wrap(CaretDown, 16);
export const IconChevronLeft  = wrap(CaretLeft, 16);
export const IconChevronRight = wrap(CaretRight, 16);

/* ── Theme ─────────────────────────────────────────────── */
export const IconSun  = wrap(Sun);
export const IconMoon = wrap(Moon);

/* ── Actions ───────────────────────────────────────────── */
export const IconSearch     = wrap(MagnifyingGlass);
export const IconMenu       = wrap(List);
export const IconPlus       = wrap(Plus, 16);
export const IconClose      = wrap(X, 18);
export const IconCheck      = wrap(Check, 18);
export const IconEdit       = wrap(PencilSimple, 14);
export const IconPaintBrush = wrap(PaintBrush, 18);
export const IconTrash      = wrap(Trash, 16);
export const IconRefresh    = wrap(ArrowsClockwise, 16);
export const IconSend       = wrap(PaperPlaneTilt, 16);
export const IconCopy       = wrap(Copy, 16);
export const IconKey        = wrap(Key, 16);

/* ── Status ────────────────────────────────────────────── */
export const IconAlert  = wrap(Warning, 16);
export const IconShield = wrap(ShieldCheck, 14);
export const IconClock  = wrap(Clock, 16);

/* ── Media ─────────────────────────────────────────────── */
export const IconPlay  = wrap(Play, 16);
export const IconPause = wrap(Pause, 16);
export const IconStop  = wrap(Stop, 16);

/* ── Visibility ────────────────────────────────────────── */
export const IconEye    = wrap(Eye, 16);
export const IconEyeOff = wrap(EyeSlash, 16);

/* ── Communication ─────────────────────────────────────── */
export const IconMail = wrap(EnvelopeSimple, 18);

/* ── Info ──────────────────────────────────────────────── */
export const IconLightbulb = wrap(Lightbulb, 18);
export const IconBook      = wrap(Book, 18);
export const IconDollar    = wrap(CurrencyDollar);
export const IconRepeat    = wrap(Repeat, 16);

/* ── Toast / Inline ────────────────────────────────────── */
export const IconCheckSmall  = wrap(CheckCircle, 16);
export const IconAlertCircle = wrap(WarningCircle, 16);
export const IconInfo        = wrap(Info, 16);
export const IconThumbsUp    = wrap(ThumbsUp);
export const IconMore        = wrap(DotsThree);
export const IconCamera      = wrap(Camera);
export const IconCar         = wrap(Car);

/* ── AI ────────────────────────────────────────────────── */
export const IconSparkle = wrap(Sparkle, 14);

/* ── Integrations ──────────────────────────────────────── */
export const IconExternalLink = wrap(ArrowSquareOut, 16);
export const IconNotebook     = wrap(Notebook, 18);

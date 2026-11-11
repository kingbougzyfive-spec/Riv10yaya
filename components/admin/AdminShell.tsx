"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ListChecks, Scale, Settings, UsersRound, CalendarClock, FileText, Wallet, Ticket, BarChart3, FileDown, Landmark, Send, Sparkles, Banknote, Plug, KeyRound, Megaphone, Network, Building2, CalendarDays, QrCode, UserRound, ClipboardList, Database, History, ShieldCheck, Home, ImageIcon, LayoutDashboard, LogOut, Menu, Palette, Users, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { api } from "@/lib/fetcher";
import { signOutEverywhereLocal } from "@/lib/session-client";
import { can } from "@/lib/rbac";
import { ROLE_LABELS, type Role } from "@/lib/roles";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "adminArea" as const },
  { href: "/admin/organizations", label: "Organisations", icon: Building2, perm: "orgView" as const },
  { href: "/admin/users", label: "Users & Roles", icon: Users, perm: "users" as const },
  { href: "/admin/members", label: "Members", icon: UserRound, perm: "members" as const },
  { href: "/admin/events", label: "Events", icon: CalendarDays, perm: "attendanceView" as const },
  { href: "/admin/registrations", label: "Registrations", icon: Ticket, perm: "attendanceView" as const },
  { href: "/admin/attendance", label: "QR Attendance", icon: QrCode, perm: "attendanceView" as const },
  { href: "/admin/remittances", label: "Remittances", icon: Wallet, perm: "finance" as const },
  { href: "/admin/finance", label: "Finance Desk", icon: Banknote, perm: "finance" as const },
  { href: "/admin/reconciliation", label: "Reconciliation", icon: Scale, perm: "finance" as const },
  { href: "/admin/reports", label: "Monthly Reports", icon: ClipboardList, perm: "reports" as const },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, perm: "finance" as const },
  { href: "/admin/exports", label: "Reports & Exports", icon: FileDown, perm: "exportAny" as const },
  { href: "/admin/leadership", label: "Leadership", icon: Landmark, perm: "governance" as const },
  { href: "/admin/departments", label: "Departments", icon: Network, perm: "content" as const },
  { href: "/admin/committees", label: "Committees", icon: UsersRound, perm: "governance" as const },
  { href: "/admin/tasks", label: "Tasks", icon: ListChecks, perm: "governance" as const },
  { href: "/admin/meetings", label: "Meetings", icon: CalendarClock, perm: "governance" as const },
  { href: "/admin/documents", label: "Documents", icon: FileText, perm: "governance" as const },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, perm: "content" as const },
  { href: "/admin/notifications", label: "Notifications", icon: Send, perm: "comms" as const },
  { href: "/admin/ai-assistant", label: "AI Assistant", icon: Sparkles, perm: "aiAny" as const },
  { href: "/admin/site", label: "Site Editor", icon: Palette, perm: "siteEdit" as const },
  { href: "/admin/media", label: "Media Library", icon: ImageIcon, perm: "media" as const },
  { href: "/admin/integrations", label: "Integrations", icon: Plug, perm: "integrations" as const },
  { href: "/admin/database", label: "Database", icon: Database, perm: "database" as const },
  { href: "/admin/settings", label: "Settings", icon: Settings, perm: "adminArea" as const },
  { href: "/admin/security", label: "Security", icon: ShieldCheck, perm: "database" as const },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: History, perm: "audit" as const },
];

export type NavItem = { href: string; label: string; icon: any; group?: string };

/** Sidebar sections, in display order. Items keep their order within a section. */
const GROUP_OF: Record<string, string> = {
  "/admin": "Overview", "/admin/analytics": "Overview",
  "/admin/organizations": "People & Structure", "/admin/users": "People & Structure", "/admin/members": "People & Structure", "/admin/leadership": "People & Structure", "/admin/departments": "People & Structure",
  "/admin/events": "Events", "/admin/registrations": "Events", "/admin/attendance": "Events",
  "/admin/reports": "Reports & Finance", "/admin/remittances": "Reports & Finance", "/admin/finance": "Reports & Finance", "/admin/reconciliation": "Reports & Finance", "/admin/exports": "Reports & Finance",
  "/admin/committees": "Governance", "/admin/tasks": "Governance", "/admin/meetings": "Governance", "/admin/documents": "Governance",
  "/admin/announcements": "Communications", "/admin/notifications": "Communications", "/admin/ai-assistant": "Communications", "/admin/site": "Communications", "/admin/media": "Communications",
  "/admin/integrations": "System", "/admin/database": "System", "/admin/settings": "System", "/admin/security": "System", "/admin/audit-logs": "System",
};
const GROUP_ORDER = ["Overview", "People & Structure", "Events", "Reports & Finance", "Governance", "Communications", "System"];
function grouped(list: NavItem[]): NavItem[] {
  return list.map((i, n) => ({ ...i, group: i.group ?? GROUP_OF[i.href], n })).sort((a: any, b: any) => (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || a.n - b.n);
}

/** `nav` and `home` let another area (the parish portal) reuse this shell with its own menu. */
export function AdminShell({ user, brand, children, nav, home = "/admin" }: { user: { name: string; role: Role }; brand: string; children: ReactNode; nav?: NavItem[]; home?: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items: NavItem[] = nav ?? grouped(ITEMS.filter((i) => can(user.role, i.perm)));

  const Nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((i, idx) => {
        const heading = i.group && i.group !== items[idx - 1]?.group ? i.group : null;
        const active = i.href === home || i.href === "/admin/finance" ? path === i.href : path.startsWith(i.href);
        return (
          <div key={i.href} className="contents">
          {heading && <p className={cn("px-3.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/65", idx > 0 && "pt-4")}>{heading}</p>}
          <Link href={i.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={cn("relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/65 transition hover:text-white", active && "text-white")}>
            {active && <span aria-hidden className="absolute inset-0 rounded-xl border border-brand/30 bg-brand/15" />}
            <i.icon className={cn("relative h-4 w-4", active && "text-brand")} /><span className="relative">{i.label}</span>
          </Link>
          </div>
        );
      })}
      <div className="mt-auto space-y-1 pt-4">
        <Link href="/admin/account" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white"><KeyRound className="h-4 w-4" />My account</Link>
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/65 hover:bg-white/5 hover:text-white"><ExternalLink className="h-4 w-4" />View website</Link>
        <button onClick={async () => { await signOutEverywhereLocal(); router.push("/login"); router.refresh(); }} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/65 hover:bg-red-500/10 hover:text-red-300"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </nav>
  );

  const Profile = (
    <div className="mb-5 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl font-black text-[#04130d]" style={{ background: "linear-gradient(135deg, rgb(var(--brand)), rgb(var(--accent)))" }}>{user.name.slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-[11px] text-white/65">{ROLE_LABELS[user.role]}</p></div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="glass-strong sticky top-0 hidden h-dvh flex-col rounded-none border-y-0 border-l-0 p-4 lg:flex">
        <Link href={home} className="mb-5 flex items-center gap-2 px-1 text-sm font-black"><Home className="h-4 w-4 text-brand" /><span className="truncate">{brand}</span></Link>
        {Profile}{Nav}
        <div className="flex gap-2 pt-3"><NotificationBell /><ThemeToggle className="flex-1" /></div>
      </aside>
      <header className="glass-strong sticky top-0 z-30 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3 lg:hidden">
        <p className="truncate text-sm font-black">{brand}</p>
        <div className="flex gap-2"><NotificationBell /><ThemeToggle /><button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-4 w-4" /></button></div>
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="glass-strong fixed inset-y-0 left-0 z-50 flex w-72 flex-col rounded-none p-4 lg:hidden" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <button className="btn btn-ghost btn-sm mb-4 self-end" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
              {Profile}{Nav}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <main id="content" tabIndex={-1} className="min-w-0 p-4 outline-none sm:p-6 lg:p-8">
        <motion.div key={path} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>{children}</motion.div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-sm text-white/65">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

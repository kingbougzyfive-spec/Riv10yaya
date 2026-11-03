"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Megaphone, Network, Building2, CalendarDays, QrCode, UserRound, ClipboardList, Database, History, Home, ImageIcon, LayoutDashboard, LogOut, Menu, Palette, Users, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { can } from "@/lib/rbac";
import { ROLE_LABELS, type Role } from "@/lib/roles";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "adminArea" as const },
  { href: "/admin/site", label: "Site Editor", icon: Palette, perm: "siteEdit" as const },
  { href: "/admin/media", label: "Media Library", icon: ImageIcon, perm: "media" as const },
  { href: "/admin/organization", label: "Organisation", icon: Building2, perm: "orgView" as const },
  { href: "/admin/reports", label: "Monthly Reports", icon: ClipboardList, perm: "reports" as const },
  { href: "/admin/finance", label: "Finance", icon: Banknote, perm: "finance" as const },
  { href: "/admin/events", label: "Events", icon: CalendarDays, perm: "attendanceView" as const },
  { href: "/admin/attendance", label: "QR Attendance", icon: QrCode, perm: "attendanceView" as const },
  { href: "/admin/members", label: "Members", icon: UserRound, perm: "members" as const },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, perm: "content" as const },
  { href: "/admin/departments", label: "Departments", icon: Network, perm: "content" as const },
  { href: "/admin/users", label: "Users & Roles", icon: Users, perm: "users" as const },
  { href: "/admin/database", label: "Database", icon: Database, perm: "database" as const },
  { href: "/admin/audit", label: "Audit Log", icon: History, perm: "audit" as const },
];

export function AdminShell({ user, brand, children }: { user: { name: string; role: Role }; brand: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((i) => can(user.role, i.perm));

  const Nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={cn("relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/65 transition hover:text-white", active && "text-white")}>
            {active && <motion.span layoutId="admin-pill" className="absolute inset-0 rounded-xl border border-brand/30 bg-brand/15" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
            <i.icon className={cn("relative h-4 w-4", active && "text-brand")} /><span className="relative">{i.label}</span>
          </Link>
        );
      })}
      <div className="mt-auto space-y-1 pt-4">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/55 hover:bg-white/5 hover:text-white"><ExternalLink className="h-4 w-4" />View website</Link>
        <button onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/55 hover:bg-red-500/10 hover:text-red-300"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </nav>
  );

  const Profile = (
    <div className="mb-5 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl font-black text-[#04130d]" style={{ background: "linear-gradient(135deg, rgb(var(--brand)), rgb(var(--accent)))" }}>{user.name.slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-[11px] text-white/45">{ROLE_LABELS[user.role]}</p></div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="glass-strong sticky top-0 hidden h-dvh flex-col rounded-none border-y-0 border-l-0 p-4 lg:flex">
        <Link href="/admin" className="mb-5 flex items-center gap-2 px-1 text-sm font-black"><Home className="h-4 w-4 text-brand" /><span className="truncate">{brand}</span></Link>
        {Profile}{Nav}
      </aside>
      <header className="glass-strong sticky top-0 z-30 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3 lg:hidden">
        <p className="truncate text-sm font-black">{brand}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-4 w-4" /></button>
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
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        <motion.div key={path} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>{children}</motion.div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-sm text-white/55">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

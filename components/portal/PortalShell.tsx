"use client";
import { Bell, ClipboardList, FileCheck, History, LayoutDashboard, QrCode, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

const NAV = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard },
  { href: "/portal/remittance", label: "Remittance", icon: Wallet },
  { href: "/portal/payment-evidence", label: "Payment evidence", icon: FileCheck },
  { href: "/portal/monthly-report", label: "Monthly report", icon: ClipboardList },
  { href: "/portal/attendance", label: "Attendance", icon: QrCode },
  { href: "/portal/history", label: "History", icon: History },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
];

/** The parish administrator's home. Same look and behaviour as the admin area, with a menu cut down to a parish's own work. */
export function PortalShell({ user, brand, children }: { user: { name: string; role: any }; brand: string; children: ReactNode }) {
  return <AdminShell user={user} brand={brand} nav={NAV} home="/portal">{children}</AdminShell>;
}

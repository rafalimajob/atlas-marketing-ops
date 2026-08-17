"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ArrowLeftRight,
  Gift,
  FileBarChart,
  Building2,
  Users,
  History,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { isAdminRole, isSuperAdmin } from "@/lib/permissions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/estoque", label: "Estoque", icon: Package },
  { href: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { href: "/consumo-area", label: "Consumo por área", icon: Building2 },
  { href: "/kits", label: "Kits", icon: Gift },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
] as const;

const ADMIN_NAV_ITEMS = [{ href: "/usuarios", label: "Usuários", icon: Users }] as const;

const SUPER_ADMIN_NAV_ITEMS = [{ href: "/auditoria", label: "Auditoria", icon: History }] as const;

export function Sidebar({
  mobileOpen = false,
  onCloseMobile,
}: {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const role = session?.user?.role;
  const navItems = [
    ...NAV_ITEMS,
    ...(role && isAdminRole(role) ? ADMIN_NAV_ITEMS : []),
    ...(role && isSuperAdmin(role) ? SUPER_ADMIN_NAV_ITEMS : []),
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 md:static md:z-auto md:translate-x-0 md:transition-[width] ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "md:w-16" : "md:w-60"}`}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-solid text-xs font-bold text-white">
          A
        </div>
        {!collapsed && (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Atlas
            </span>
            <span className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">Marketing Ops</span>
          </span>
        )}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 md:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 pt-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onCloseMobile}
              title={collapsed ? label : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-primary-subtle text-brand-primary"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-primary" />
              )}
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        className="m-2 hidden h-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 md:flex"
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
    </aside>
  );
}

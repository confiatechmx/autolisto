"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  Receipt,
  TrendingUp,
  Package2,
  Contact,
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { empresa } = useTenant();

  // Hide bottom nav on public customer portal or login
  if (pathname.startsWith("/orden/") || pathname.startsWith("/login")) {
    return null;
  }

  const navItems = [
    {
      href: "/tablero",
      label: "Workflow",
      icon: Kanban,
      active: pathname.startsWith("/tablero"),
    },
    {
      href: "/",
      label: "Resumen",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      href: "/caja",
      label: "Caja POS",
      icon: Receipt,
      active: pathname.startsWith("/caja"),
    },
    {
      href: "/reportes",
      label: "Reportes",
      icon: TrendingUp,
      active: pathname.startsWith("/reportes"),
    },
    {
      href: "/inventario",
      label: "Stock",
      icon: Package2,
      active: pathname.startsWith("/inventario"),
    },
  ];

  return (
    <nav
      aria-label="Navegación Móvil y Tablet"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 pb-[env(safe-area-inset-bottom)] shadow-lg select-none print:hidden"
    >
      <div className="grid grid-cols-5 h-14 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all relative cursor-pointer ${
                isActive
                  ? "text-sky-400 font-extrabold"
                  : "text-slate-400 hover:text-slate-200 active:scale-95"
              }`}
            >
              {isActive && (
                <span
                  style={{ backgroundColor: empresa?.color_primario || "#0284c7" }}
                  className="absolute top-0 w-8 h-0.5 rounded-full"
                />
              )}
              <Icon
                size={19}
                className={isActive ? "text-sky-400" : "text-slate-400"}
                strokeWidth={isActive ? 2.3 : 1.8}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

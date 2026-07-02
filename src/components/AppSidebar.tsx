"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, FileText, Settings, LogOut, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",          label: "Offres",    icon: FileText },
  { href: "/analytics", label: "Analyse",   icon: BarChart2 },
  { href: "/settings",  label: "Paramètres",icon: Settings },
];

interface Props {
  userName?: string;
}

export default function AppSidebar({ userName }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0 bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-slate-900 flex items-center justify-center">
            <Layers size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">Atmosphere</p>
            <p className="text-[10px] text-slate-400 leading-tight">Dashboard Marges</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">Navigation</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" || pathname.startsWith("/quotes/") : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-1">
        {userName && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
            <div className="size-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-slate-600 truncate">{userName}</span>
          </div>
        )}
        <a
          href="/api/auth/logout"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <LogOut size={14} />
          Déconnexion
        </a>
      </div>
    </aside>
  );
}

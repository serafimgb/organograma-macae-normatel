"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GitFork,
  FolderKanban,
  Upload,
  LogOut,
  ChevronDown,
  UserCircle2,
  DollarSign,
  ExternalLink,
  Settings,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

interface Project {
  id: string;
  code: string;
  name: string;
  organogramUrl?: string | null;
}

type TabFlags = {
  dashboard: boolean;
  organograma: boolean;
  efetivo: boolean;
  salarios: boolean;
};

interface SidebarProps {
  projects: Project[];
  userRole: string;
  userName?: string | null;
  tabMap: Record<string, TabFlags> | null;
}

export function Sidebar({ projects, userRole, userName, tabMap }: SidebarProps) {
  const pathname = usePathname();
  const [expandedProject, setExpandedProject] = useState<string | null>(
    projects[0]?.code ?? null
  );

  const projectLinks = (project: Project) => {
    const { code, id: projectId, organogramUrl } = project;
    const flags = tabMap?.[projectId];
    const links: { href: string; label: string; icon: React.ElementType; external?: boolean }[] = [];

    if (!flags || flags.dashboard) {
      links.push({ href: `/projects/${code}/dashboard`, label: "Dashboard", icon: LayoutDashboard });
    }
    if (!flags || flags.organograma) {
      if (organogramUrl) {
        links.push({ href: organogramUrl, label: "Organograma", icon: ExternalLink, external: true });
      } else {
        links.push({ href: `/projects/${code}/organograma`, label: "Organograma", icon: GitFork });
      }
    }
    if (!flags || flags.efetivo) {
      links.push({ href: `/projects/${code}/efetivo`, label: "Efetivo", icon: Users });
    }
    if (flags?.salarios) {
      links.push({ href: `/projects/${code}/salarios`, label: "Salários", icon: DollarSign });
    }

    return links;
  };

  return (
    <aside className="flex h-screen w-60 flex-col text-white" style={{ backgroundColor: "#1a3a1a" }}>
      <div
        className="flex h-16 items-center justify-center px-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#142814" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-branco.png"
          alt="Normatel Engenharia"
          className="object-contain h-12"
        />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {projects.map((project) => {
          const isExpanded = expandedProject === project.code;
          const links = projectLinks(project);
          const isActive = links.some((l) => pathname === l.href);

          return (
            <div key={project.code}>
              <button
                onClick={() => setExpandedProject(isExpanded ? null : project.code)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <FolderKanban className="h-4 w-4 shrink-0" />
                  <span className="truncate">{project.code} · {project.name}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform text-white/50",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5 pl-3 border-l" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
                  {links.map(({ href, label, icon: Icon, external }) =>
                    external ? (
                      <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors text-white/60 hover:text-white hover:bg-white/10"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </a>
                    ) : (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                          pathname === href
                            ? "text-white font-semibold"
                            : "text-white/60 hover:text-white hover:bg-white/10"
                        )}
                        style={pathname === href ? {
                          backgroundColor: "#4caf50",
                          boxShadow: "0 1px 4px rgba(76,175,80,0.4)"
                        } : {}}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}

        {userRole === "ADMIN" && (
          <>
            <div className="pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
              Administração
            </div>
            {[
              { href: "/admin/users", label: "Usuários & Permissões", icon: Users },
              { href: "/admin/projects", label: "Config. Projetos", icon: Settings },
              { href: "/admin/import", label: "Importar Excel", icon: Upload },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  pathname === href
                    ? "text-white font-semibold"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
                style={pathname === href ? { backgroundColor: "#4caf50" } : {}}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="border-t p-3 space-y-1" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="flex items-center gap-2 px-2 py-1">
          <UserCircle2 className="h-5 w-5 shrink-0 text-white/40" />
          <span className="text-xs text-white/60 truncate">{userName}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  MessageSquare,
<<<<<<< HEAD
  Bot,
=======
>>>>>>> origin/main
  Settings,
  LogOut,
  FileText,
  ChevronLeft,
  ChevronRight,
  AppWindow,
<<<<<<< HEAD
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { Avatar } from '@/components/ui/avatar';
import { ContextSelector } from '@/components/dashboard/context-selector';
import { Button } from '@/components/ui/button';
=======
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { Avatar } from "@/components/ui/avatar";
import { ContextSelector } from "@/components/dashboard/context-selector";
import { Button } from "@/components/ui/button";
>>>>>>> origin/main
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  {
    title: null,
    items: [
<<<<<<< HEAD
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: 'CRM',
    items: [
      { name: 'Leads', href: '/dashboard/leads', icon: Users, exact: false },
      { name: 'Audiências', href: '/dashboard/audiences', icon: Target, exact: false },
      { name: 'Agentes', href: '/dashboard/agents', icon: Bot, exact: false },
    ],
  },
  {
    title: 'CONTEÚDO',
    items: [
      { name: 'Posts', href: '/dashboard/posts', icon: FileText, exact: false },
      { name: 'Inbox', href: '/dashboard/inbox', icon: MessageSquare, exact: false },
    ],
  },
  {
    title: 'SISTEMA',
    items: [
      { name: 'Apps', href: '/dashboard/apps', icon: AppWindow, exact: false },
      { name: 'Configurações', href: '/dashboard/settings', icon: Settings, exact: false },
=======
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "CRM",
    items: [
      { name: "Leads", href: "/dashboard/leads", icon: Users, exact: false },
      {
        name: "Audiências",
        href: "/dashboard/audiences",
        icon: Target,
        exact: false,
      },
    ],
  },
  {
    title: "CONTEÚDO",
    items: [
      { name: "Posts", href: "/dashboard/posts", icon: FileText, exact: false },
      {
        name: "Inbox",
        href: "/dashboard/inbox",
        icon: MessageSquare,
        exact: false,
      },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { name: "Apps", href: "/dashboard/apps", icon: AppWindow, exact: false },
      {
        name: "Configurações",
        href: "/dashboard/settings",
        icon: Settings,
        exact: false,
      },
>>>>>>> origin/main
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Hydration mismatch handling: Initial render fits the default state (expanded)
  // useEffect handles localStorage sync

  return (
    <aside
      className={cn(
        "flex flex-col bg-white shadow-sm border-r transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b transition-all duration-300",
          isCollapsed ? "justify-center px-0" : "px-6",
        )}
      >
        <span
          className={cn(
            "font-bold text-primary transition-all duration-300",
            isCollapsed ? "text-xl" : "text-xl",
          )}
        >
          {isCollapsed ? "L" : "Lia 360"}
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-white text-gray-400 shadow-sm hover:text-primary z-10"
        onClick={toggleSidebar}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      <div className="p-3 border-b">
        <ContextSelector collapsed={isCollapsed} />
      </div>

      <nav className="flex-1 space-y-6 px-3 py-4">
        <TooltipProvider delayDuration={0}>
          {navigation.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {section.title && !isCollapsed && (
                <h3 className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {section.title}
                </h3>
              )}
              {section.items.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
<<<<<<< HEAD
                  pathname.startsWith(item.href + "/");
=======
                    pathname.startsWith(item.href + "/");
>>>>>>> origin/main

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center justify-center rounded-lg h-[30px] w-[30px] transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-gray-700 hover:bg-gray-100",
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="sr-only">{item.name}</span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.name}</TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 h-[30px] text-[14px] font-medium transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-gray-700 hover:text-primary hover:bg-primary/10",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </TooltipProvider>
      </nav>
    </aside>
  );
}

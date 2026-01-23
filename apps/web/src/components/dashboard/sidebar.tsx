'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Target,
    MessageSquare,
    BarChart3,
    Settings,
    LogOut,
    FileText,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { Avatar } from '@/components/ui/avatar';
import { ContextSelector } from '@/components/dashboard/context-selector';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { name: 'Leads', href: '/dashboard/leads', icon: Users },
    { name: 'Posts', href: '/dashboard/posts', icon: FileText },
    { name: 'Audiências', href: '/dashboard/audiences', icon: Target },
    { name: 'Inbox', href: '/dashboard/inbox', icon: MessageSquare },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Configurações', href: '/dashboard/settings', icon: Settings },
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
        const saved = localStorage.getItem('sidebar-collapsed');
        if (saved) {
            setIsCollapsed(JSON.parse(saved));
        }
    }, []);

    const toggleSidebar = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    // Hydration mismatch handling: Initial render fits the default state (expanded)
    // useEffect handles localStorage sync

    return (
        <aside
            className={cn(
                'flex flex-col bg-white shadow-sm border-r transition-all duration-300 ease-in-out relative',
                isCollapsed ? 'w-20' : 'w-64'
            )}
        >
            <div className={cn("flex h-16 items-center border-b transition-all duration-300", isCollapsed ? "justify-center px-0" : "px-6")}>
                <span className={cn("font-bold text-primary transition-all duration-300", isCollapsed ? "text-xl" : "text-xl")}>
                    {isCollapsed ? 'L' : 'Lia 360'}
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

            <nav className="flex-1 space-y-1 px-3 py-4">
                <TooltipProvider delayDuration={0}>
                    {navigation.map((item) => {
                        const isActive = item.exact
                            ? pathname === item.href
                            : pathname === item.href || pathname.startsWith(item.href + '/');

                        if (isCollapsed) {
                            return (
                                <Tooltip key={item.name}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                'flex items-center justify-center rounded-lg p-2 transition-colors',
                                                isActive
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            )}
                                        >
                                            <item.icon className="h-5 w-5" />
                                            <span className="sr-only">{item.name}</span>
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        {item.name}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        }

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-gray-700 hover:bg-gray-100'
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </TooltipProvider>
            </nav>

            <div className="border-t p-4">
                <div className={cn("flex items-center gap-3", isCollapsed && "flex-col justify-center")}>
                    <Avatar fallback={user?.fullName} size={isCollapsed ? "sm" : "sm"} />

                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden transition-all duration-300 opacity-100">
                            <p className="truncate text-sm font-medium">{user?.fullName}</p>
                            <p className="truncate text-xs text-gray-500">{user?.email}</p>
                        </div>
                    )}

                    <TooltipProvider delayDuration={0}>
                        {isCollapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={handleLogout}
                                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                                    >
                                        <LogOut className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right">Sair</TooltipContent>
                            </Tooltip>
                        ) : (
                            <button
                                onClick={handleLogout}
                                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                                title="Sair"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        )}
                    </TooltipProvider>

                </div>
            </div>
        </aside>
    );
}

'use client';

import { usePathname } from 'next/navigation';
import { Bell, ChevronRight, Search, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Header() {
    const pathname = usePathname();

    // Simple breadcrumb logic: just showing the current page name prettified
    // In a real app we might want more complex breadcrumbs based on the path segments
    const getPageTitle = (path: string) => {
        const segments = path.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        if (!lastSegment) return 'Dashboard';

        // Capitalize and replace hyphens
        return lastSegment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const title = getPageTitle(pathname);

    return (
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border/40 bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {/* Left: Breadcrumbs / Title */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden font-medium text-foreground sm:inline-block">Dashboard</span>
                <ChevronRight className="h-4 w-4" />
                <h1 className="font-semibold text-foreground">{title}</h1>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
                {/* Search Bar - hidden on very small screens */}
                <div className="relative hidden w-full max-w-[300px] md:flex">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar..."
                        className="w-full rounded-full bg-background pl-9 md:w-[200px] lg:w-[300px]"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                        <Bell className="h-5 w-5" />
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-600" />
                        <span className="sr-only">Notificações</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Configurações</span>
                    </Button>
                </div>
            </div>
        </header>
    );
}

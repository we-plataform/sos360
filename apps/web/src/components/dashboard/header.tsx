'use client';

import { useState, useEffect } from 'react';
import { Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearchDialog } from '@/components/search/global-search-dialog';

export function Header() {
    const [searchOpen, setSearchOpen] = useState(false);

    // Global keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <header className="sticky top-0 z-40 h-16 w-full border-b border-border/40 bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                {/* Right: Actions */}
                <div className="absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-2">
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
            </header>

            {/* Search Button - fixed to viewport center */}
            <div className="fixed left-1/2 top-0 z-50 hidden h-16 -translate-x-1/2 items-center md:flex">
                <Button
                    variant="outline"
                    className="h-9 w-[200px] justify-start rounded-full bg-background pl-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:w-[300px]"
                    onClick={() => setSearchOpen(true)}
                >
                    <Search className="mr-2 h-4 w-4" />
                    <span className="flex-1 text-left">Buscar...</span>
                    <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </Button>
            </div>

            <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}

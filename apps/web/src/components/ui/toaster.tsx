'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
    return (
        <SonnerToaster
            position="top-right"
            richColors
            closeButton
            expand={false}
            toastOptions={{
                duration: 4000,
                classNames: {
                    toast: 'group border-border shadow-lg',
                    title: 'text-foreground',
                    description: 'text-muted-foreground',
                    actionButton: 'bg-primary text-primary-foreground',
                    cancelButton: 'bg-muted text-muted-foreground',
                    closeButton: 'bg-background border-border',
                },
            }}
        />
    );
}

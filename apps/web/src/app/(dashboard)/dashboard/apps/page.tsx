'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet';
import { InstagramIcon, LinkedInIcon, WhatsappIcon } from '@/components/ui/social-icons';
import { CheckCircle2, Circle, Settings2 } from 'lucide-react';
import { toast } from 'sonner'; // Or use toast from ui/toaster if available. checking toaster.tsx exists.

interface AppConfig {
    id: 'whatsapp' | 'instagram' | 'linkedin';
    name: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    connected: boolean;
}

export default function AppsPage() {
    const [apps, setApps] = useState<AppConfig[]>([
        {
            id: 'whatsapp',
            name: 'WhatsApp',
            description: 'Conecte sua conta do WhatsApp Business para enviar mensagens automáticas.',
            icon: WhatsappIcon,
            connected: false,
        },
        {
            id: 'instagram',
            name: 'Instagram',
            description: 'Gerencie DMs e comentários do Instagram diretamente pelo dashboard.',
            icon: InstagramIcon,
            connected: false,
        },
        {
            id: 'linkedin',
            name: 'LinkedIn',
            description: 'Automatize conexões e mensagens no LinkedIn para expandir seu network.',
            icon: LinkedInIcon,
            connected: false,
        },
    ]);

    const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleOpenDrawer = (app: AppConfig) => {
        setSelectedApp(app);
        setIsDrawerOpen(true);
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedApp) return;

        setIsLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));

        setApps((prev) =>
            prev.map((app) =>
                app.id === selectedApp.id ? { ...app, connected: true } : app
            )
        );

        setIsLoading(false);
        setIsDrawerOpen(false);
        // Assuming user has a toast library, generic alert for now or implement toast later if I see specifically what is used. 
        // I saw toaster.tsx in components/ui, likely "useToast".
    };

    const handleDisconnect = async () => {
        if (!selectedApp) return;
        setIsLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setApps((prev) =>
            prev.map((app) =>
                app.id === selectedApp.id ? { ...app, connected: false } : app
            )
        );
        setIsLoading(false);
        setIsDrawerOpen(false);
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Meus Apps</h1>
                <p className="text-muted-foreground">
                    Gerencie suas integrações com plataformas externas.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {apps.map((app) => (
                    <Card key={app.id} className="flex flex-col">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="p-2 bg-muted/20 rounded-lg">
                                    <app.icon size={32} />
                                </div>
                                {app.connected ? (
                                    <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Ativo
                                    </div>
                                ) : (
                                    <div className="flex items-center text-gray-400 bg-gray-50 px-2 py-1 rounded-full text-xs font-medium">
                                        <Circle className="w-3 h-3 mr-1" />
                                        Inativo
                                    </div>
                                )}
                            </div>
                            <CardTitle className="mt-4">{app.name}</CardTitle>
                            <CardDescription>{app.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            {/* Additional info or stats could go here */}
                        </CardContent>
                        <CardFooter>
                            <Button
                                className="w-full"
                                variant={app.connected ? "outline" : "default"}
                                onClick={() => handleOpenDrawer(app)}
                            >
                                {app.connected ? (
                                    <>
                                        <Settings2 className="w-4 h-4 mr-2" />
                                        Configurar
                                    </>
                                ) : (
                                    "Conectar"
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent side="right" className="w-full sm:w-[540px]">
                    <SheetHeader>
                        <div className="flex items-center gap-3 mb-2">
                            {selectedApp && <selectedApp.icon size={32} />}
                            <SheetTitle>Configurar {selectedApp?.name}</SheetTitle>
                        </div>
                        <SheetDescription>
                            Configure as credenciais e permissões para a integração com o {selectedApp?.name}.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedApp && (
                        <div className="py-6 space-y-6">
                            {selectedApp.id === 'whatsapp' && (
                                <form onSubmit={handleConnect} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="wp-number">Número do WhatsApp Business</Label>
                                        <Input id="wp-number" placeholder="+55 11 99999-9999" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="wp-api-key">API Key (Meta for Developers)</Label>
                                        <Input id="wp-api-key" type="password" placeholder="EAA..." required />
                                    </div>
                                    <div className="pt-4 flex gap-2">
                                        <Button type="submit" disabled={isLoading} className="flex-1">
                                            {isLoading ? "Salvando..." : "Salvar e Conectar"}
                                        </Button>
                                        {selectedApp.connected && (
                                            <Button type="button" variant="destructive" onClick={handleDisconnect} disabled={isLoading}>
                                                Desconectar
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            )}

                            {selectedApp.id === 'instagram' && (
                                <form onSubmit={handleConnect} className="space-y-4">
                                    <div className="rounded-md bg-blue-50 p-4 mb-4">
                                        <p className="text-sm text-blue-700">
                                            Para conectar o Instagram, você será redirecionado para a página de login do Facebook/Instagram.
                                        </p>
                                    </div>
                                    <div className="pt-4 flex gap-2">
                                        <Button type="submit" disabled={isLoading} className="flex-1 bg-[#E4405F] hover:bg-[#D93050]">
                                            {isLoading ? "Conectando..." : "Conectar com Instagram"}
                                        </Button>
                                        {selectedApp.connected && (
                                            <Button type="button" variant="destructive" onClick={handleDisconnect} disabled={isLoading}>
                                                Desconectar
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            )}

                            {selectedApp.id === 'linkedin' && (
                                <form onSubmit={handleConnect} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="li-email">Email do LinkedIn</Label>
                                        <Input id="li-email" type="email" placeholder="seu-email@exemplo.com" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="li-client-id">Client ID</Label>
                                        <Input id="li-client-id" placeholder="Ex: 789..." required />
                                    </div>
                                    <div className="pt-4 flex gap-2">
                                        <Button type="submit" disabled={isLoading} className="flex-1 bg-[#0A66C2] hover:bg-[#004182]">
                                            {isLoading ? "Conectando..." : "Conectar LinkedIn"}
                                        </Button>
                                        {selectedApp.connected && (
                                            <Button type="button" variant="destructive" onClick={handleDisconnect} disabled={isLoading}>
                                                Desconectar
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

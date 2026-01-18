'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Zap,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar } from '@/components/ui/avatar';
import { ContextSelector } from '@/components/dashboard/context-selector';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'Leads', href: '/dashboard/leads', icon: Users },
  { name: 'Inbox', href: '/dashboard/inbox', icon: MessageSquare },
  { name: 'Automações', href: '/dashboard/automations', icon: Zap },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Configurações', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, setContext, setAvailableCompanies, isLoading, logout } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const data = await api.getMe() as any;
        setUser(data.user);

        if (data.context && data.context.company && data.context.workspace) {
          setContext(data.context.company, data.context.workspace);
        }

        if (data.companies) {
          setAvailableCompanies(data.companies);
        }
      } catch (error) {
        console.error(error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, setUser, setContext, setAvailableCompanies]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (isLoading && !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-white shadow-sm border-r">
        <div className="flex h-16 items-center px-6 border-b">
          <span className="text-xl font-bold text-indigo-600">SOS 360</span>
        </div>

        <div className="p-3 border-b">
          <ContextSelector />
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item: any) => {
            const isActive = (item as any).exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <Avatar fallback={user.fullName} size="sm" />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{user.fullName}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setContext = useAuthStore((state) => state.setContext);
  const setAvailableCompanies = useAuthStore(
    (state) => state.setAvailableCompanies,
  );

  // Wait for client-side mount to avoid hydration issues
  useEffect(() => {
    setMounted(true);
    // Initialize API client refresh after mount
    api.initializeRefresh();
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const checkAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const data = (await api.getMe()) as any;
        setUser(data.user);

        if (data.context && data.context.company && data.context.workspace) {
          setContext(data.context.company, data.context.workspace);
        }

        if (data.companies) {
          setAvailableCompanies(data.companies);
        }
        setAuthChecked(true);
      } catch (error) {
        console.error("Auth check failed:", error);
        toast.error("Sessão expirada", {
          description: "Por favor, faça login novamente.",
        });
        router.push("/login");
      }
    };

    checkAuth();
  }, [mounted, router, setUser, setContext, setAvailableCompanies]);

  // Show loading spinner until mounted AND auth is checked
  if (!mounted || !authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

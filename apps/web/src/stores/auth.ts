import * as React from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser, CompanyContext, WorkspaceContext, CompanyWithWorkspaces } from '@lia360/shared';
import { api } from '../lib/api';

interface AuthState {
  user: AuthUser | null;
  currentCompany: CompanyContext | null;
  currentWorkspace: WorkspaceContext | null;
  availableCompanies: CompanyWithWorkspaces[];
  isAuthenticated: boolean;

  setUser: (user: AuthUser | null) => void;
  setContext: (company: CompanyContext, workspace: WorkspaceContext) => void;
  setAvailableCompanies: (companies: CompanyWithWorkspaces[]) => void;

  switchWorkspace: (workspaceId: string) => Promise<void>;
  switchCompany: (companyId: string, workspaceId: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      currentCompany: null,
      currentWorkspace: null,
      availableCompanies: [],
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setContext: (company, workspace) =>
        set({ currentCompany: company, currentWorkspace: workspace }),

      setAvailableCompanies: (companies) =>
        set({ availableCompanies: companies }),

      switchWorkspace: async (workspaceId) => {
        const { currentCompany } = get();
        if (!currentCompany) return;

        try {
          const data = await api.switchContext(currentCompany.id, workspaceId);
          set({
            currentCompany: data.context.company,
            currentWorkspace: data.context.workspace,
          });
          window.location.reload();
        } catch (error) {
          console.error('Failed to switch workspace:', error);
          throw error;
        }
      },

      switchCompany: async (companyId, workspaceId) => {
        try {
          const data = await api.switchContext(companyId, workspaceId);
          set({
            currentCompany: data.context.company,
            currentWorkspace: data.context.workspace,
          });
          window.location.reload();
        } catch (error) {
          console.error('Failed to switch company:', error);
          throw error;
        }
      },

      logout: () => {
        api.logout();
        set({
          user: null,
          isAuthenticated: false,
          currentCompany: null,
          currentWorkspace: null,
          availableCompanies: []
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        currentCompany: state.currentCompany,
        currentWorkspace: state.currentWorkspace,
        availableCompanies: state.availableCompanies
      }),
    }
  )
);

// Hook for waiting for hydration in components
export const useAuthHydration = () => {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
};

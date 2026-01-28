"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

function SelectContextContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const availableCompanies = useAuthStore((state) => state.availableCompanies);
  const setContext = useAuthStore((state) => state.setContext);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  const handleSelect = async (companyId: string, workspaceId: string) => {
    if (!token) return;
    setLoading(true);

    try {
      const data = await api.selectContext(token, companyId, workspaceId);
      setContext(data.context.company, data.context.workspace);
      toast.success("Workspace selecionado!", {
        description: `Bem-vindo ao ${data.context.workspace.name}`,
      });
      router.push("/dashboard");
    } catch (err) {
      toast.error("Erro ao selecionar workspace", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Selecione um Workspace</CardTitle>
        <CardDescription>
          Escolha em qual ambiente você deseja trabalhar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {availableCompanies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma empresa encontrada.
            </div>
          ) : (
            availableCompanies.map((company) => (
              <div key={company.id} className="space-y-3">
                <h3 className="font-semibold text-gray-900 border-b pb-1 flex justify-between items-center">
                  <span>{company.name}</span>
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {company.myRole}
                  </span>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {company.workspaces.map((workspace) => (
                    <Button
                      key={workspace.id}
                      variant="outline"
                      className="h-auto flex-col items-start p-4 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                      onClick={() => handleSelect(company.id, workspace.id)}
                      disabled={loading}
                    >
                      <div className="font-medium text-lg">
                        {workspace.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 capitalize flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {workspace.myRole}
                      </div>
                    </Button>
                  ))}
                  {company.workspaces.length === 0 && (
                    <div className="text-sm text-gray-400 italic">
                      Nenhum workspace disponível nesta empresa.
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 text-center pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => router.push("/login")}
            disabled={loading}
          >
            Voltar para Login
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SelectContextPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <Suspense fallback={<div>Carregando...</div>}>
        <SelectContextContent />
      </Suspense>
    </div>
  );
}

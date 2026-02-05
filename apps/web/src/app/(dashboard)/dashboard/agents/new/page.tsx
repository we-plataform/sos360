"use client";

import { AgentWizard } from "@/components/agents/AgentWizard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewAgentPage() {
    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/agents">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Novo Agente</h1>
                    <p className="text-muted-foreground">
                        Configure um novo assistente de IA.
                    </p>
                </div>
            </div>

            <AgentWizard />
        </div>
    );
}

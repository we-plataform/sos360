export interface Agent {
    id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    type: string;
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
    workspaceId: string;
}

export type CreateAgentDTO = Omit<Agent, "id" | "createdAt" | "updatedAt" | "workspaceId">;
export type UpdateAgentDTO = Partial<CreateAgentDTO>;

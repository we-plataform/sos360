import type { ApiResponse } from '@lia360/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// --- JWT HELPERS ---
// Helper to decode JWT without verification (for expiration check only)
function decodeJWT(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    console.error('[API] Failed to decode JWT:', e);
    return null;
  }
}

// Check if token is expiring soon (within 1 day)
function isTokenExpiringSoon(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;

  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  // Return true if token expires within 1 day
  return expirationTime - now < oneDay;
}

// Get token expiration time in milliseconds
function getTokenExpirationTime(token: string): number {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return 0;
  return payload.exp * 1000;
}

class ApiClient {
  private baseUrl: string;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private refreshInitialized = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Initialize proactive refresh - must be called from client-side component
  initializeRefresh() {
    if (typeof window === 'undefined' || this.refreshInitialized) {
      return;
    }
    this.refreshInitialized = true;
    this.startProactiveRefresh();
  }

  private startProactiveRefresh() {
    // Check every 30 minutes
    this.refreshInterval = setInterval(async () => {
      const token = this.getToken();
      const refreshToken = localStorage.getItem('refreshToken');

      if (token && refreshToken && isTokenExpiringSoon(token)) {
        console.log('[API] Token expiring soon, refreshing proactively...');
        const expirationTime = getTokenExpirationTime(token);
        const now = Date.now();
        const hoursRemaining = Math.round((expirationTime - now) / (1000 * 60 * 60));
        console.log(`[API] Time until expiry: ${hoursRemaining} hours`);

        await this.refreshToken();
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    // Also check immediately on init
    setTimeout(async () => {
      const token = this.getToken();
      if (token && isTokenExpiringSoon(token)) {
        console.log('[API] Token expiring soon on init, refreshing...');
        await this.refreshToken();
      }
    }, 1000); // Check after 1 second
  }

  private stopProactiveRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      // Handle token refresh
      if (response.status === 401 && token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request(endpoint, options);
        }
      }

      throw new Error(data.error?.detail || 'An error occurred');
    }

    return data.data as T;
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.logout();
        return false;
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.data.accessToken);
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }

  // Auth
  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.detail || 'Login failed');
    }

    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);

    return data.data;
  }

  async register(email: string, password: string, fullName: string, companyName: string, workspaceName?: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, companyName, workspaceName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.detail || 'Registration failed');
    }

    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);

    return data.data;
  }

  async selectContext(selectionToken: string, companyId: string, workspaceId: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/select-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectionToken, companyId, workspaceId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.detail || 'Context selection failed');
    }

    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);

    return data.data;
  }

  async switchContext(companyId: string, workspaceId: string) {
    return this.request<{
      accessToken: string;
      context: any;
      expiresIn: number;
    }>('/api/v1/auth/switch-context', {
      method: 'POST',
      body: JSON.stringify({ companyId, workspaceId }),
    }).then((data) => {
      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      return data;
    });
  }

  async getMe() {
    return this.request('/api/v1/auth/me');
  }

  async createWorkspace(name: string) {
    return this.request<{
      id: string;
      name: string;
      myRole: string;
      createdAt: string;
    }>('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // Leads
  async getLeads(params?: Record<string, string | number>) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request(`/api/v1/leads${query ? `?${query}` : ''}`);
  }

  async getLead(id: string) {
    return this.request(`/api/v1/leads/${id}`);
  }

  async createLead(data: Record<string, unknown>) {
    return this.request('/api/v1/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string, data: Record<string, unknown>) {
    return this.request(`/api/v1/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: string) {
    return this.request(`/api/v1/leads/${id}`, {
      method: 'DELETE',
    });
  }

  async importLeads(data: Record<string, unknown>) {
    return this.request('/api/v1/leads/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async exportLeads(params?: {
    fields?: string[];
    stageId?: string;
    tagIds?: string[];
    createdAfter?: string;
    createdBefore?: string;
  }): Promise<Blob> {
    const token = this.getToken();

    const searchParams = new URLSearchParams();
    if (params) {
      if (params.fields && params.fields.length > 0) {
        searchParams.append('fields', params.fields.join(','));
      }
      if (params.stageId) {
        searchParams.append('stageId', params.stageId);
      }
      if (params.tagIds && params.tagIds.length > 0) {
        params.tagIds.forEach((tagId) => searchParams.append('tagIds', tagId));
      }
      if (params.createdAfter) {
        searchParams.append('createdAfter', params.createdAfter);
      }
      if (params.createdBefore) {
        searchParams.append('createdBefore', params.createdBefore);
      }
    }

    const query = searchParams.toString();
    const url = `${this.baseUrl}/api/v1/leads/export${query ? `?${query}` : ''}`;

    const response = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.detail || 'Export failed');
    }

    return response.blob();
  }

  // Tags
  async getTags() {
    return this.request('/api/v1/tags');
  }

  async createTag(data: { name: string; color?: string }) {
    return this.request('/api/v1/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Conversations
  async getConversations(params?: Record<string, string | number>) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request(`/api/v1/conversations${query ? `?${query}` : ''}`);
  }

  async getConversation(id: string) {
    return this.request(`/api/v1/conversations/${id}`);
  }

  async sendMessage(conversationId: string, content: string) {
    return this.request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async markAsRead(conversationId: string) {
    return this.request(`/api/v1/conversations/${conversationId}/read`, {
      method: 'POST',
    });
  }

  // Templates
  async getTemplates() {
    return this.request('/api/v1/templates');
  }

  async createTemplate(data: Record<string, unknown>) {
    return this.request('/api/v1/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Analytics
  async getAnalyticsOverview(params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    const query = searchParams.toString();
    return this.request(`/api/v1/analytics/overview${query ? `?${query}` : ''}`);
  }

  async getAnalyticsFunnel() {
    return this.request('/api/v1/analytics/funnel');
  }



  // Users
  async getUsers() {
    return this.request('/api/v1/users');
  }

  async inviteUser(email: string, role?: string) {
    return this.request('/api/v1/users/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  // Pipelines
  async getPipelines() {
    return this.request('/api/v1/pipelines');
  }

  async getPipeline(id: string) {
    return this.request(`/api/v1/pipelines/${id}`);
  }

  async createPipeline(data: { name: string; description?: string; stages?: { name: string; color?: string }[] }) {
    return this.request('/api/v1/pipelines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePipeline(id: string, data: { name?: string; description?: string }) {
    return this.request(`/api/v1/pipelines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePipeline(id: string) {
    return this.request(`/api/v1/pipelines/${id}`, {
      method: 'DELETE',
    });
  }

  async addPipelineStage(pipelineId: string, data: { name: string; color?: string }) {
    return this.request(`/api/v1/pipelines/${pipelineId}/stages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reorderStages(pipelineId: string, stages: { id: string; order: number }[]) {
    return this.request(`/api/v1/pipelines/${pipelineId}/stages/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ stages }),
    });
  }

  async updateStage(pipelineId: string, stageId: string, data: { name?: string; color?: string }) {
    return this.request(`/api/v1/pipelines/${pipelineId}/stages/${stageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteStage(pipelineId: string, stageId: string) {
    return this.request(`/api/v1/pipelines/${pipelineId}/stages/${stageId}`, {
      method: 'DELETE',
    });
  }

  async moveLead(pipelineId: string, leadId: string, stageId: string, position: number) {
    return this.request(`/api/v1/pipelines/${pipelineId}/leads/move`, {
      method: 'POST',
      body: JSON.stringify({ leadId, stageId, position }),
    });
  }

  async migratePipeline(pipelineId: string) {
    return this.request(`/api/v1/pipelines/${pipelineId}/migrate`, {
      method: 'POST',
    });
  }

  // Audiences
  async getAudiences() {
    return this.request('/api/v1/audiences');
  }

  async getAudience(id: string) {
    return this.request(`/api/v1/audiences/${id}`);
  }

  async createAudience(data: Record<string, unknown>) {
    return this.request('/api/v1/audiences', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAudience(id: string, data: Record<string, unknown>) {
    return this.request(`/api/v1/audiences/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAudience(id: string) {
    return this.request(`/api/v1/audiences/${id}`, {
      method: 'DELETE',
    });
  }

  // Automations
  async upsertAutomation(data: Record<string, unknown>) {
    return this.request('/api/v1/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async triggerAutomation(id: string, config?: { maxLeads?: number; interval?: string }) {
    return this.request(`/api/v1/automations/${id}/trigger`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // Posts
  async getPosts(params?: Record<string, string | number | boolean>) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.request(`/api/v1/posts${query ? `?${query}` : ''}`);
  }

  async getPost(id: string) {
    return this.request(`/api/v1/posts/${id}`);
  }

  async createPost(data: Record<string, unknown>) {
    return this.request('/api/v1/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePost(id: string, data: Record<string, unknown>) {
    return this.request(`/api/v1/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePost(id: string) {
    return this.request(`/api/v1/posts/${id}`, {
      method: 'DELETE',
    });
  }

  async importPosts(data: Record<string, unknown>) {
    return this.request('/api/v1/posts/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async linkPostToLead(postId: string, leadId: string) {
    return this.request(`/api/v1/posts/${postId}/link-lead`, {
      method: 'POST',
      body: JSON.stringify({ leadId }),
    });
  }

  async unlinkPostFromLead(postId: string) {
    return this.request(`/api/v1/posts/${postId}/link-lead`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient(API_URL);

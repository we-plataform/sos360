import type { ApiResponse } from '@sos360/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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

  async register(email: string, password: string, fullName: string, workspaceName: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, workspaceName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.detail || 'Registration failed');
    }

    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);

    return data.data;
  }

  async getMe() {
    return this.request('/api/v1/auth/me');
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

  async getAnalyticsTimeline(params?: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    const query = searchParams.toString();
    return this.request(`/api/v1/analytics/timeline${query ? `?${query}` : ''}`);
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
}

export const api = new ApiClient(API_URL);

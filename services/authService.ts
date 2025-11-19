
import { API_BASE_URL } from "../constants";

export const authService = {
  register: async (name: string, email: string, password: string, plan: any) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, plan })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro na API");
    }
    return await response.json();
  },

  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password })
    });

    if (!response.ok) {
        throw new Error("Credenciais inválidas");
    }
    return await response.json();
  },

  getUserProfile: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("No token");

      const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
  },

  logout: async () => {
      localStorage.removeItem('token');
  }
};

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../services/endpoints';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    setUser: (user: User) => void;
    refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoading: true,
            isAuthenticated: false,

            login: async (email: string, password: string) => {
                const { access_token } = await authApi.login({ email, password });
                localStorage.setItem('token', access_token);

                const user = await authApi.getCurrentUser();

                set({
                    token: access_token,
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                });
            },

            logout: () => {
                localStorage.removeItem('token');
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                });
            },

            checkAuth: async () => {
                const token = localStorage.getItem('token');

                if (!token) {
                    set({ isLoading: false, isAuthenticated: false });
                    return;
                }

                try {
                    const user = await authApi.getCurrentUser();
                    set({
                        token,
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch {
                    localStorage.removeItem('token');
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },

            setUser: (user: User) => {
                set({ user });
            },

            refreshUser: async () => {
                try {
                    const user = await authApi.getCurrentUser();
                    set({ user });
                } catch {
                    // Ignore refresh failures; global auth guard handles invalid sessions.
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({ token: state.token }),
        }
    )
);

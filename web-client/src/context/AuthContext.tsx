'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

import { ApiError, get, post } from '@/lib/api';

export interface User {
    id: string;
    email: string;
    created_at: string;
    updated_at: string | null;
}

interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();
    const [authError, setAuthError] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
            try {
                const res = await get<{ user: User }>('/auth/me');
                return res.user;
            } catch (err) {
                if (err instanceof ApiError && err.status === 401) {
                    return null;
                }
                throw err;
            }
        },
        retry: false,
        staleTime: Infinity,
    });

    const user = data ?? null;

    const login = useCallback(
        async (email: string, password: string) => {
            setAuthError(null);
            const res = await post<{ user: User }>('/auth/login', {
                email,
                password,
            });
            queryClient.setQueryData(['auth', 'me'], res.user);
        },
        [queryClient],
    );

    const signup = useCallback(
        async (email: string, password: string) => {
            setAuthError(null);
            const res = await post<{ user: User }>('/auth/register', {
                email,
                password,
            });
            queryClient.setQueryData(['auth', 'me'], res.user);
        },
        [queryClient],
    );

    const loginWithGoogle = useCallback(async () => {
        setAuthError(null);
        // TODO: implement Google OAuth redirect
        throw new Error('Google OAuth not yet implemented');
    }, []);

    const logout = useCallback(async () => {
        try {
            await post('/auth/logout');
        } finally {
            queryClient.setQueryData(['auth', 'me'], null);
            queryClient.clear();
        }
    }, [queryClient]);

    const value = useMemo(
        () => ({
            user,
            isLoading,
            login,
            signup,
            loginWithGoogle,
            logout,
            authError,
        }),
        [user, isLoading, login, signup, loginWithGoogle, logout, authError],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}

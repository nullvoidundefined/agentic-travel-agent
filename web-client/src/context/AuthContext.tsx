'use client';

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const login = useCallback(async (_email: string, _password: string) => {
        setIsLoading(true);
        // Simulate API call
        await new Promise((r) => setTimeout(r, 600));
        setUser({ id: '1', name: 'Demo User', email: _email });
        setIsLoading(false);
    }, []);

    const signup = useCallback(
        async (_name: string, _email: string, _password: string) => {
            setIsLoading(true);
            await new Promise((r) => setTimeout(r, 600));
            setUser({ id: '1', name: _name, email: _email });
            setIsLoading(false);
        },
        [],
    );

    const logout = useCallback(() => {
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, isLoading, login, signup, logout }),
        [user, isLoading, login, signup, logout],
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

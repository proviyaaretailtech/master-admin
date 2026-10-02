import React, { createContext, useEffect, useState } from "react";
import { authApi } from "../api";
import { User } from "../@types";

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null; user?: User }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Fetch current user on mount if token exists
  useEffect(() => {
    const fetchMe = async () => {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.getMe();
        setUser(response.user);
      } catch (error) {
        console.warn("Failed to restore session from token:", error);
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await authApi.login({ email, password });
      const { user: loggedInUser, token: authToken } = data;
      localStorage.setItem("token", authToken);
      setToken(authToken);
      setUser(loggedInUser);
      return { error: null, user: loggedInUser };
    } catch (err: any) {
      return {
        error: err instanceof Error ? err : new Error(err?.message || "Invalid credentials"),
      };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

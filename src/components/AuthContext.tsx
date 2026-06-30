import React, { createContext, useState, useEffect, useContext } from "react";
import { AuthState, UserProfile, BootstrapConfig } from "../types";

interface AuthContextType {
  authState: AuthState;
  bootstrapStatus: BootstrapConfig | null;
  checkBootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  logout: () => Promise<void>;
  refreshTimerState: () => void;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false
  });
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapConfig | null>(null);

  // Read saved session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("sp_user");
    const savedAccess = localStorage.getItem("sp_access");
    const savedRefresh = localStorage.getItem("sp_refresh");

    if (savedUser && savedAccess && savedRefresh) {
      setAuthState({
        user: JSON.parse(savedUser),
        accessToken: savedAccess,
        refreshToken: savedRefresh,
        isAuthenticated: true
      });
    }
    checkBootstrap();
  }, []);

  const checkBootstrap = async () => {
    try {
      const response = await fetch("/api/v1/bootstrap/status");
      const data = await response.json();
      setBootstrapStatus(data);
    } catch (err) {
      console.error("Failed to query system bootstrap status:", err);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || "Invalid credentials configuration.",
          code: data.code
        };
      }

      setAuthState({
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        isAuthenticated: true
      });

      localStorage.setItem("sp_user", JSON.stringify(data.user));
      localStorage.setItem("sp_access", data.access_token);
      localStorage.setItem("sp_refresh", data.refresh_token);

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: "Network error occurred. Unable to contact authentication services."
      };
    }
  };

  const logout = async () => {
    try {
      const token = authState.refreshToken;
      if (token) {
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: token })
        });
      }
    } catch (err) {
      console.error("Revoke request during logout failed:", err);
    } finally {
      setAuthState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false
      });
      localStorage.removeItem("sp_user");
      localStorage.removeItem("sp_access");
      localStorage.removeItem("sp_refresh");
    }
  };

  // Perform a refresh token query dynamically
  const performTokenRefresh = async (token: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: token })
      });
      if (!res.ok) throw new Error("Invalid session refresh");
      const data = await res.json();
      
      setAuthState(prev => {
        const nextState = {
          ...prev,
          accessToken: data.access_token,
          refreshToken: data.refresh_token
        };
        localStorage.setItem("sp_access", data.access_token);
        localStorage.setItem("sp_refresh", data.refresh_token);
        return nextState;
      });

      return data.access_token;
    } catch {
      // Trigger logout if refresh fails
      logout();
      return null;
    }
  };

  const refreshTimerState = () => {
    if (authState.refreshToken) {
      performTokenRefresh(authState.refreshToken);
    }
  };

  // Safe fetch wrapper performing authentication attach & token retry logic
  const apiFetch = async (path: string, options: RequestInit = {}) => {
    let currentToken = authState.accessToken;
    const headers = new Headers(options.headers || {});
    
    if (currentToken) {
      headers.set("Authorization", `Bearer ${currentToken}`);
    }
    options.headers = headers;

    let response = await fetch(path, options);

    // If unauthorized event occurred, attempt dynamic refresh rotation exactly once
    if (response.status === 401 && authState.refreshToken) {
      console.log("[AUTH-FETCH] Token invalid/expired. Requesting rotation...");
      const refreshedToken = await performTokenRefresh(authState.refreshToken);
      if (refreshedToken) {
        headers.set("Authorization", `Bearer ${refreshedToken}`);
        options.headers = headers;
        response = await fetch(path, options);
      }
    }

    return response;
  };

  return (
    <AuthContext.Provider
      value={{
        authState,
        bootstrapStatus,
        checkBootstrap,
        login,
        logout,
        refreshTimerState,
        apiFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be mapped within an AuthProvider");
  return context;
};

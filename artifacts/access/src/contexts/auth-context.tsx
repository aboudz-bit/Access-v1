import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, User, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  refetchUser: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError, refetch } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        refetch();
        setLocation("/login");
      }
    }
  });

  useEffect(() => {
    if (!isLoading) {
      if (isError || !user) {
        if (location !== "/login") {
          setLocation("/login");
        }
      } else if (location === "/" || location === "/login") {
        if (user.role === "admin") setLocation("/admin");
        else if (user.role === "interpreter") setLocation("/interpreter");
        else setLocation("/select-language");
      }
    }
  }, [user, isLoading, isError, location, setLocation]);

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, logout: () => logoutMutation.mutate(), refetchUser: () => { refetch(); } }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

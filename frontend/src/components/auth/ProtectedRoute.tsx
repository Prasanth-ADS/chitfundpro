import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";

export function ProtectedRoute() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await api.get("/api/auth/me");
      return res.data;
    },
    retry: false
  });

  if (isLoading) return <div className="flex items-center justify-center p-8 h-screen text-muted-foreground">Loading session...</div>;
  if (isError || !data) return <Navigate to="/login" replace />;

  return <Outlet />;
}

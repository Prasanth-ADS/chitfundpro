import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export function ProtectedRoute() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await axios.get("http://localhost:5000/api/auth/me", { withCredentials: true });
      return res.data;
    },
    retry: false
  });

  if (isLoading) return <div className="flex items-center justify-center p-8 h-screen text-muted-foreground">Loading session...</div>;
  if (isError || !data) return <Navigate to="/login" replace />;

  return <Outlet />;
}

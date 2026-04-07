import { useLocation } from "wouter";
import { useAuthStore } from "@/stores/auth-store";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [, setLocation] = useLocation();

  if (!isAuthenticated()) {
    setLocation("/login");
    return null;
  }

  if (!isAdmin()) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600">
            You don't have permission to access the admin panel.
            Your current role is <strong>{user?.role ?? "unknown"}</strong>.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Return to Store
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

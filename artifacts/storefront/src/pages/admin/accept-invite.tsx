import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function AcceptInvitePage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "done">("loading");
  const [submitting, setSubmitting] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (!token) { setStatus("invalid"); setError("No invite token provided"); return; }
    fetch(`${API}/admin/accept-invite/validate?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.email) { setEmail(d.email); setStatus("valid"); }
        else { setStatus("invalid"); setError(d.error || "Invalid invite"); }
      })
      .catch(() => { setStatus("invalid"); setError("Failed to validate invite"); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/admin/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to accept invite"); return; }
      setAuth(data.user, data.token);
      setStatus("done");
      setTimeout(() => navigate("/admin"), 2000);
    } catch { setError("Network error"); } finally { setSubmitting(false); }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-muted-foreground">Validating invite...</div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg border p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold">Invalid Invite</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg border p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold">Welcome!</h1>
          <p className="text-muted-foreground">Your admin account is set up. Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg border p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 text-blue-600 mx-auto" />
          <h1 className="text-xl font-bold">Accept Admin Invite</h1>
          <p className="text-sm text-muted-foreground">Set up your admin account for <strong>{email}</strong></p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="space-y-2">
            <Label>Confirm Password *</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Setting up..." : "Create Account"}
          </Button>
        </form>
      </div>
    </div>
  );
}

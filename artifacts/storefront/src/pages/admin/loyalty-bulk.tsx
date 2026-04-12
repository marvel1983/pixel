import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import {
  Loader2,
  ArrowLeft,
  Trophy,
  Clock,
  Users,
  X,
  Plus,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

// ── Tier badge colors ──────────────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  BRONZE: "bg-amber-600 text-white",
  SILVER: "bg-slate-400 text-white",
  GOLD: "bg-yellow-500 text-white",
  PLATINUM: "bg-violet-600 text-white",
};

// ── Types ─────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  userId: number;
  email: string;
  tier: string;
  lifetimePoints: number;
  pointsBalance: number;
}

interface ExpiryEntry {
  userId: number;
  email: string;
  expiringPoints: number;
  expiryDate: string;
}

// ── Leaderboard Tab ───────────────────────────────────────────────────────

function LeaderboardTab() {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/admin/loyalty/leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : d.leaderboard ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Trophy className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No leaderboard data yet.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Rank</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead className="text-right">Lifetime Points</TableHead>
          <TableHead className="text-right">Current Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((entry, i) => (
          <TableRow key={entry.userId}>
            <TableCell className="font-bold text-muted-foreground">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </TableCell>
            <TableCell className="font-medium">{entry.email}</TableCell>
            <TableCell>
              <Badge
                className={`text-xs ${TIER_BADGE[entry.tier] ?? "bg-gray-400 text-white"}`}
              >
                {entry.tier}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {entry.lifetimePoints.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {entry.pointsBalance.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Expiry Report Tab ─────────────────────────────────────────────────────

function ExpiryReportTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [data, setData] = useState<ExpiryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/loyalty/expiry-report`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : d.report ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function sendWarnings() {
    setSending(true);
    try {
      const res = await fetch(`${API}/admin/loyalty/trigger-expiry-warnings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Warning emails sent successfully" });
    } catch {
      toast({ title: "Failed to send warnings", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function processExpired() {
    setProcessing(true);
    try {
      const res = await fetch(`${API}/admin/loyalty/bulk-expire`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast({ title: `Processed expired points${data.count ? ` for ${data.count} users` : ""}` });
    } catch {
      toast({ title: "Failed to process expired points", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={sendWarnings}
          disabled={sending}
        >
          {sending && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
          Send Warning Emails
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={processExpired}
          disabled={processing}
        >
          {processing && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
          Process Expired Points
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No expiring points found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Points Expiring</TableHead>
              <TableHead>Expiry Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry) => (
              <TableRow key={entry.userId}>
                <TableCell className="font-medium">{entry.email}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-orange-600">
                  {entry.expiringPoints.toLocaleString()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(entry.expiryDate).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Bulk Adjust Tab ───────────────────────────────────────────────────────

function BulkAdjustTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [type, setType] = useState("ADJUST");
  const [submitting, setSubmitting] = useState(false);

  function addUser() {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (!userIds.includes(trimmed)) {
      setUserIds((prev) => [...prev, trimmed]);
    }
    setEmailInput("");
  }

  function removeUser(id: string) {
    setUserIds((prev) => prev.filter((u) => u !== id));
  }

  async function handleSubmit() {
    if (userIds.length === 0) {
      toast({ title: "Add at least one user", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/admin/loyalty/bulk-adjust`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ userIds, points, description, type }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const count = data.adjusted ?? userIds.length;
      toast({ title: `Points adjusted for ${count} user${count !== 1 ? "s" : ""}` });
      setUserIds([]);
      setPoints(0);
      setDescription("");
    } catch {
      toast({ title: "Failed to adjust points", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      {/* User list builder */}
      <div>
        <Label>Add Users (by email or user ID)</Label>
        <div className="flex gap-2 mt-1.5">
          <Input
            placeholder="user@example.com or user ID"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUser())}
          />
          <Button variant="outline" size="icon" onClick={addUser}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {userIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {userIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
              >
                {id}
                <button
                  type="button"
                  onClick={() => removeUser(id)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {userIds.length} user{userIds.length !== 1 ? "s" : ""} queued
        </p>
      </div>

      {/* Points */}
      <div>
        <Label>Points (use negative to deduct)</Label>
        <Input
          type="number"
          value={points}
          onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
          className="max-w-xs mt-1"
        />
      </div>

      {/* Description */}
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Reason for adjustment…"
          rows={2}
          className="mt-1"
        />
      </div>

      {/* Type */}
      <div>
        <Label>Transaction Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="max-w-xs mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ADJUST">ADJUST</SelectItem>
            <SelectItem value="ADMIN">ADMIN</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleSubmit} disabled={submitting || userIds.length === 0}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Apply Bulk Adjustment
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function LoyaltyBulkPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/loyalty">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> Bulk Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Leaderboard, expiry management, and bulk point adjustments
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="leaderboard">
            <TabsList>
              <TabsTrigger value="leaderboard" className="gap-1.5">
                <Trophy className="h-4 w-4" /> Leaderboard
              </TabsTrigger>
              <TabsTrigger value="expiry" className="gap-1.5">
                <Clock className="h-4 w-4" /> Expiry Report
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-1.5">
                <Users className="h-4 w-4" /> Bulk Adjust
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leaderboard" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Top Customers by Lifetime Points</CardTitle>
                  <CardDescription>Sorted by lifetime points earned</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <LeaderboardTab />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expiry" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Points Expiry Report</CardTitle>
                  <CardDescription>Customers with points expiring soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExpiryReportTab />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bulk" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Bulk Point Adjustment</CardTitle>
                  <CardDescription>
                    Award or deduct points for multiple users at once
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BulkAdjustTab />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

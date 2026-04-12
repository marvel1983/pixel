import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Loader2, Plus, Pencil, Trash2, ArrowLeft, Zap } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface LoyaltyEvent {
  id: number;
  name: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

interface EventForm {
  name: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

const EMPTY_FORM: EventForm = {
  name: "",
  multiplier: 2,
  startsAt: "",
  endsAt: "",
  active: true,
};

function getEventStatus(event: LoyaltyEvent): { label: string; class: string } {
  if (!event.active) return { label: "Inactive", class: "bg-gray-400 text-white" };
  const now = Date.now();
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  if (now < start) return { label: "Scheduled", class: "bg-slate-500 text-white" };
  if (now > end) return { label: "Expired", class: "bg-red-500 text-white" };
  return { label: "Active", class: "bg-green-600 text-white" };
}

function toDatetimeLocal(iso: string) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export default function LoyaltyEventsPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [events, setEvents] = useState<LoyaltyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/loyalty/events`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : data.events ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, [token]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(event: LoyaltyEvent) {
    setEditId(event.id);
    setForm({
      name: event.name,
      multiplier: event.multiplier,
      startsAt: toDatetimeLocal(event.startsAt),
      endsAt: toDatetimeLocal(event.endsAt),
      active: event.active,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.startsAt || !form.endsAt) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        multiplier: form.multiplier,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        active: form.active,
      };
      const url = editId
        ? `${API}/admin/loyalty/events/${editId}`
        : `${API}/admin/loyalty/events`;
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast({ title: editId ? "Event updated" : "Event created" });
      setDialogOpen(false);
      loadEvents();
    } catch {
      toast({ title: "Failed to save event", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`${API}/admin/loyalty/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Event deleted" });
      setDeleteId(null);
      loadEvents();
    } catch {
      toast({ title: "Failed to delete event", variant: "destructive" });
    }
  }

  async function handleToggle(id: number) {
    try {
      const res = await fetch(`${API}/admin/loyalty/events/${id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      loadEvents();
    } catch {
      toast({ title: "Failed to toggle event", variant: "destructive" });
    }
  }

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
            <Zap className="h-6 w-6 text-yellow-500" /> Double-Points Events
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create limited-time multiplier events for loyalty points
          </p>
        </div>
        <Button onClick={openCreate} className="ml-auto gap-1">
          <Plus className="h-4 w-4" /> New Event
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No events yet. Create your first double-points event!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Multiplier</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => {
                  const status = getEventStatus(ev);
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-medium">{ev.name}</TableCell>
                      <TableCell>{ev.multiplier}x</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(ev.startsAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(ev.endsAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${status.class}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={ev.active}
                          onCheckedChange={() => handleToggle(ev.id)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(ev)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(ev.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Event" : "New Double-Points Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Event Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Black Friday Bonus"
              />
            </div>
            <div>
              <Label>Multiplier (1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                step={0.5}
                value={form.multiplier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, multiplier: parseFloat(e.target.value) || 1 }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label className="cursor-pointer">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editId ? "Save Changes" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Event?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove the event. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && handleDelete(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

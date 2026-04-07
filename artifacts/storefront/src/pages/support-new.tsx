import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const CATEGORIES = [
  { value: "ORDER_ISSUE", label: "Order Issue" },
  { value: "KEY_PROBLEM", label: "Key / License Problem" },
  { value: "PAYMENT", label: "Payment" },
  { value: "REFUND", label: "Refund Request" },
  { value: "ACCOUNT", label: "Account" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "OTHER", label: "Other" },
];

export default function SupportNewPage() {
  const token = useAuthStore((s) => s.token);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orders, setOrders] = useState<{ id: number; orderNumber: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetch(`${API}/orders/mine`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setOrders(data.map((o: { id: number; orderNumber: string }) => ({ id: o.id, orderNumber: o.orderNumber }))); })
      .catch(() => {});
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          subject, category, message,
          orderId: orderId && orderId !== "NONE" ? parseInt(orderId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Ticket Created", description: `Your ticket ${data.ticketNumber} has been submitted.` });
      navigate(`/support/tickets/${data.ticketNumber}`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create ticket", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Support", href: "/account?tab=support" }, { label: "New Ticket" }]} />
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Submit a Support Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" maxLength={300} required />
            </div>
            {orders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="order">Related Order (optional)</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger><SelectValue placeholder="Select an order..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.orderNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue in detail..." rows={6} maxLength={5000} required />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Ticket
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
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

const CATEGORY_KEYS: Record<string, string> = {
  ORDER_ISSUE: "support.orderIssue",
  KEY_PROBLEM: "support.keyProblem",
  PAYMENT: "support.payment",
  REFUND: "support.refundRequest",
  ACCOUNT: "support.accountIssue",
  TECHNICAL: "support.technical",
  OTHER: "support.other",
};

export default function SupportNewPage() {
  const { t } = useTranslation();
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
      toast({ title: t("support.ticketCreated"), description: data.ticketNumber });
      navigate(`/support/tickets/${data.ticketNumber}`);
    } catch (err) {
      toast({ title: t("common.error"), description: err instanceof Error ? err.message : t("common.somethingWentWrong"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("nav.support"), href: "/account?tab=support" }, { label: t("support.newTicket") }]} />
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("support.newTicket")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">{t("support.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_KEYS).map(([value, key]) => (
                    <SelectItem key={value} value={value}>{t(key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">{t("support.subject")}</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("support.subjectPlaceholder")} maxLength={300} required />
            </div>
            {orders.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="order">{t("support.relatedOrder")}</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger><SelectValue placeholder={t("support.selectOrder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.orderNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="message">{t("support.message")}</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("support.messagePlaceholder")} rows={6} maxLength={5000} required />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t("support.submitTicket")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

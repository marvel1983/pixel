import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function AffiliateApplyPage() {
  const token = useAuthStore((s) => s.token);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState(false);
  const [form, setForm] = useState({
    websiteUrl: "",
    socialMedia: "",
    promotionMethod: "",
    paypalEmail: "",
  });

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    fetch(`${API}/account/affiliate`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.profile) setExisting(true); });
  }, [token]);

  if (!token) return null;

  if (existing) return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Breadcrumbs crumbs={[{ label: "Affiliates", href: "/affiliates" }, { label: "Apply" }]} />
      <Card className="mt-6">
        <CardContent className="py-12 text-center">
          <h2 className="text-xl font-bold mb-2">Application Already Submitted</h2>
          <p className="text-muted-foreground mb-4">You already have an affiliate profile. Check your dashboard for status.</p>
          <Button onClick={() => setLocation("/account")}>Go to Account</Button>
        </CardContent>
      </Card>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.promotionMethod.length < 10) {
      toast({ title: "Error", description: "Please describe your promotion method (at least 10 characters)", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/affiliates/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Application Submitted!", description: data.profile.status === "APPROVED" ? "Your application was auto-approved! Check your dashboard." : "We'll review your application shortly." });
      setLocation("/account");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Breadcrumbs crumbs={[{ label: "Affiliates", href: "/affiliates" }, { label: "Apply" }]} />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Affiliate Application</CardTitle>
          <CardDescription>Tell us how you plan to promote PixelCodes</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Website URL (optional)</Label>
              <Input placeholder="https://yoursite.com" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Social Media (optional)</Label>
              <Input placeholder="YouTube, Twitter, etc." value={form.socialMedia} onChange={(e) => setForm({ ...form, socialMedia: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>How will you promote us? *</Label>
              <Textarea placeholder="Describe your promotion strategy..." rows={4} value={form.promotionMethod} onChange={(e) => setForm({ ...form, promotionMethod: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>PayPal Email (for payouts, optional)</Label>
              <Input type="email" placeholder="paypal@example.com" value={form.paypalEmail} onChange={(e) => setForm({ ...form, paypalEmail: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

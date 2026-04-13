import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { MessageSquare, HelpCircle, PackageSearch } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SupportHubPage() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs crumbs={[{ label: t("nav.support") }]} />
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{t("support.hubTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("support.hubSubtitle")}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <CardTitle className="text-lg">{t("support.hubFaqTitle")}</CardTitle>
              <CardDescription>{t("support.hubFaqDesc")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/faq">{t("support.hubFaqCta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <PackageSearch className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <CardTitle className="text-lg">{t("support.hubOrderTitle")}</CardTitle>
              <CardDescription>{t("support.hubOrderDesc")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/order-lookup">{t("support.hubOrderCta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <CardTitle className="text-lg">{t("support.hubTicketTitle")}</CardTitle>
              <CardDescription>{t("support.hubTicketDesc")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/support/new">{t("support.newTicket")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

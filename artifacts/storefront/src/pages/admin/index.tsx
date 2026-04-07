import { Switch, Route } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminGuard } from "@/components/admin/admin-guard";
import AdminDashboard from "./dashboard";
import AnalyticsPage from "./analytics";
import AdminProductsPage from "./products";
import ProductEditPage from "./product-edit";
import AdminCategoriesPage from "./categories";
import AdminOrdersPage from "./orders";
import OrderDetailPage from "./order-detail";
import AdminKeysPage from "./keys";
import AdminClaimsPage from "./claims";
import AdminDiscountsPage from "./discounts";
import DiscountFormPage from "./discount-form";
import DiscountBulkPage from "./discount-bulk";
import DiscountUsagePage from "./discount-usage";
import AdminCustomersPage from "./customers";
import CustomerDetailPage from "./customer-detail";
import AdminReviewsPage from "./reviews";
import AdminBannersPage from "./banners";
import AdminStaticPagesPage from "./static-pages";
import PageEditPage from "./page-edit";
import FaqEditorPage from "./faq-editor";
import AdminSettingsPage from "./settings";
import AuditLogPage from "./audit-log";
import MetenziBalancePage from "./metenzi-balance";
import CheckoutUpsellPage from "./checkout-upsell";
import HomepageSectionsPage from "./homepage-sections";
import BrandSectionsPage from "./brand-sections";
import EmailTemplatesPage from "./email-templates";
import EmailTemplateEditPage from "./email-template-edit";
import TaxSettingsPage from "./tax-settings";
import AdminUsersPage from "./admin-users";
import RefundsPage from "./refunds";
import AdminGiftCardsPage from "./gift-cards";
import AdminAffiliatesPage from "./affiliates";

function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground">
        This section is under development.
      </div>
    </div>
  );
}

export default function AdminRoot() {
  return (
    <AdminGuard>
      <AdminLayout>
        <Switch>
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/analytics" component={AnalyticsPage} />
          <Route path="/admin/products/:id" component={ProductEditPage} />
          <Route path="/admin/products" component={AdminProductsPage} />
          <Route path="/admin/categories" component={AdminCategoriesPage} />
          <Route path="/admin/platforms">
            <AdminPlaceholder title="Platforms" />
          </Route>
          <Route path="/admin/orders/:id" component={OrderDetailPage} />
          <Route path="/admin/orders" component={AdminOrdersPage} />
          <Route path="/admin/transactions">
            <AdminPlaceholder title="Transactions" />
          </Route>
          <Route path="/admin/fulfillment" component={AdminKeysPage} />
          <Route path="/admin/claims" component={AdminClaimsPage} />
          <Route path="/admin/discounts/bulk" component={DiscountBulkPage} />
          <Route path="/admin/discounts/new" component={DiscountFormPage} />
          <Route path="/admin/discounts/:id/usage" component={DiscountUsagePage} />
          <Route path="/admin/discounts/:id" component={DiscountFormPage} />
          <Route path="/admin/discounts" component={AdminDiscountsPage} />
          <Route path="/admin/checkout-upsell" component={CheckoutUpsellPage} />
          <Route path="/admin/customers/:id" component={CustomerDetailPage} />
          <Route path="/admin/customers" component={AdminCustomersPage} />
          <Route path="/admin/reviews" component={AdminReviewsPage} />
          <Route path="/admin/homepage-sections" component={HomepageSectionsPage} />
          <Route path="/admin/brand-sections" component={BrandSectionsPage} />
          <Route path="/admin/email-templates/:id" component={EmailTemplateEditPage} />
          <Route path="/admin/email-templates" component={EmailTemplatesPage} />
          <Route path="/admin/tax-settings" component={TaxSettingsPage} />
          <Route path="/admin/banners" component={AdminBannersPage} />
          <Route path="/admin/refunds" component={RefundsPage} />
          <Route path="/admin/gift-cards" component={AdminGiftCardsPage} />
          <Route path="/admin/affiliates" component={AdminAffiliatesPage} />
          <Route path="/admin/admin-users" component={AdminUsersPage} />
          <Route path="/admin/notifications">
            <AdminPlaceholder title="Notifications" />
          </Route>
          <Route path="/admin/pages/new" component={PageEditPage} />
          <Route path="/admin/pages/faq" component={FaqEditorPage} />
          <Route path="/admin/pages/:id" component={PageEditPage} />
          <Route path="/admin/pages" component={AdminStaticPagesPage} />
          <Route path="/admin/media">
            <AdminPlaceholder title="Media" />
          </Route>
          <Route path="/admin/settings" component={AdminSettingsPage} />
          <Route path="/admin/audit-log" component={AuditLogPage} />
          <Route path="/admin/metenzi-balance" component={MetenziBalancePage} />
          <Route path="/admin/security">
            <AdminPlaceholder title="Security" />
          </Route>
          <Route>
            <AdminPlaceholder title="Page Not Found" />
          </Route>
        </Switch>
      </AdminLayout>
    </AdminGuard>
  );
}

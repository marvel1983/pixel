import { Switch, Route } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminGuard } from "@/components/admin/admin-guard";
import AdminDashboard from "./dashboard";
import AnalyticsPage from "./analytics";

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
          <Route path="/admin/products">
            <AdminPlaceholder title="Products" />
          </Route>
          <Route path="/admin/categories">
            <AdminPlaceholder title="Categories" />
          </Route>
          <Route path="/admin/platforms">
            <AdminPlaceholder title="Platforms" />
          </Route>
          <Route path="/admin/orders/:id">
            <AdminPlaceholder title="Order Detail" />
          </Route>
          <Route path="/admin/orders">
            <AdminPlaceholder title="Orders" />
          </Route>
          <Route path="/admin/transactions">
            <AdminPlaceholder title="Transactions" />
          </Route>
          <Route path="/admin/fulfillment">
            <AdminPlaceholder title="Fulfillment" />
          </Route>
          <Route path="/admin/users">
            <AdminPlaceholder title="Users" />
          </Route>
          <Route path="/admin/notifications">
            <AdminPlaceholder title="Notifications" />
          </Route>
          <Route path="/admin/pages">
            <AdminPlaceholder title="Pages" />
          </Route>
          <Route path="/admin/media">
            <AdminPlaceholder title="Media" />
          </Route>
          <Route path="/admin/settings">
            <AdminPlaceholder title="Settings" />
          </Route>
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

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteLayout } from "@/components/layout/site-layout";
import HomePage from "@/pages/home";
import ShopPage from "@/pages/shop";
import CategoryPage from "@/pages/category";
import OutletPage from "@/pages/outlet";
import HotOffersPage from "@/pages/hot-offers";
import ProductDetailPage from "@/pages/product-detail";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";
import OrderCompletePage from "@/pages/order-complete";
import OrderLookupPage from "@/pages/order-lookup";
import AccountOrdersPage from "@/pages/account-orders";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AccountPage from "@/pages/account";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <SiteLayout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/shop" component={ShopPage} />
        <Route path="/category/:slug" component={CategoryPage} />
        <Route path="/outlet" component={OutletPage} />
        <Route path="/hot-offers" component={HotOffersPage} />
        <Route path="/product/:slug" component={ProductDetailPage} />
        <Route path="/cart" component={CartPage} />
        <Route path="/checkout" component={CheckoutPage} />
        <Route path="/order-complete/:orderNumber" component={OrderCompletePage} />
        <Route path="/order-lookup" component={OrderLookupPage} />
        <Route path="/account/orders" component={AccountOrdersPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password/:token" component={ResetPasswordPage} />
        <Route path="/account" component={AccountPage} />
        <Route component={NotFound} />
      </Switch>
    </SiteLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteLayout } from "@/components/layout/site-layout";
import { HreflangTags } from "@/components/seo/hreflang";
import { useAuthStore } from "@/stores/auth-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useFlashSaleStore } from "@/stores/flash-sale-store";
import { useLoyaltyStore } from "@/stores/loyalty-store";
import { useThemeStore } from "@/stores/theme-store";
import { useMaintenanceCheck, MaintenancePage } from "@/components/maintenance-page";
import { CookieBanner } from "@/components/cookie/cookie-banner";
import { ConsentGatedScripts } from "@/components/cookie/consent-scripts";
import HomePage from "@/pages/home";
import ShopPage from "@/pages/shop";
import CategoryPage from "@/pages/category";
import OutletPage from "@/pages/outlet";
import HotOffersPage from "@/pages/hot-offers";
import BestSellersRedirect from "@/pages/best-sellers";
import NewArrivalsRedirect from "@/pages/new-arrivals";
import DealsRedirect from "@/pages/deals-redirect";
import SupportHubPage from "@/pages/support-hub";
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
import AccountBalancePage from "@/pages/account-balance";
import AccountLoyaltyPage from "@/pages/account-loyalty";
import WishlistPage from "@/pages/wishlist";
import ComparePage from "@/pages/compare";
import GiftCardsPage from "@/pages/gift-cards";
import AccountGiftCardsPage from "@/pages/account-gift-cards";
import AffiliatesPage from "@/pages/affiliates";
import AffiliateApplyPage from "@/pages/affiliate-apply";
import CartRecoverPage from "@/pages/cart-recover";
import SearchPage from "@/pages/search";
import FlashSalePage from "@/pages/flash-sale";
import BundlesPage from "@/pages/bundles";
import BundleDetailPage from "@/pages/bundle-detail";
import SupportNewPage from "@/pages/support-new";
import SupportTicketPage from "@/pages/support-ticket";
import NewsletterConfirmPage from "@/pages/newsletter-confirm";
import NewsletterUnsubscribePage from "@/pages/newsletter-unsubscribe";
import AuthGoogleSuccessPage from "@/pages/auth-google-success";
import { useReferralTracking } from "@/hooks/use-referral";
import { ExitIntentPopup } from "@/components/newsletter/exit-intent-popup";
import { PurchaseToastProvider } from "@/components/social-proof/purchase-toast";
import BlogPage from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";
import BusinessPage from "@/pages/business";
import SurveyPage from "@/pages/survey";
import FaqPage from "@/pages/faq";
import StaticPageView from "@/pages/static-page";
import AdminRoot from "@/pages/admin/index";
import AcceptInvitePage from "@/pages/admin/accept-invite";
import NotFound from "@/pages/not-found";
import { RouteBreadcrumbJsonLd } from "@/components/seo/json-ld";

const queryClient = new QueryClient();

function GlobalBreadcrumbs() {
  const [location] = useLocation();
  return <RouteBreadcrumbJsonLd path={location} />;
}

function StorefrontWithMaintenance() {
  useReferralTracking();
  const { info, checked } = useMaintenanceCheck();
  if (!checked) return null;
  if (info?.maintenance) {
    return <MaintenancePage message={info.message} estimate={info.estimate} />;
  }
  return (
    <SiteLayout>
      <GlobalBreadcrumbs />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/shop" component={ShopPage} />
        <Route path="/category/:slug" component={CategoryPage} />
        <Route path="/outlet" component={OutletPage} />
        <Route path="/hot-offers" component={HotOffersPage} />
        <Route path="/best-sellers" component={BestSellersRedirect} />
        <Route path="/new-arrivals" component={NewArrivalsRedirect} />
        <Route path="/deals" component={DealsRedirect} />
        <Route path="/flash-sale" component={FlashSalePage} />
        <Route path="/bundles/:slug" component={BundleDetailPage} />
        <Route path="/bundles" component={BundlesPage} />
        <Route path="/product/:slug" component={ProductDetailPage} />
        <Route path="/gift-cards" component={GiftCardsPage} />
        <Route path="/account/gift-cards" component={AccountGiftCardsPage} />
        <Route path="/affiliates/apply" component={AffiliateApplyPage} />
        <Route path="/affiliates" component={AffiliatesPage} />
        <Route path="/cart/recover/:token" component={CartRecoverPage} />
        <Route path="/cart" component={CartPage} />
        <Route path="/checkout" component={CheckoutPage} />
        <Route path="/order-complete/:orderNumber" component={OrderCompletePage} />
        <Route path="/order-lookup" component={OrderLookupPage} />
        <Route path="/account/orders" component={AccountOrdersPage} />
        <Route path="/account/balance" component={AccountBalancePage} />
        <Route path="/account/loyalty" component={AccountLoyaltyPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/auth/google/success" component={AuthGoogleSuccessPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password/:token" component={ResetPasswordPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/wishlist" component={WishlistPage} />
        <Route path="/compare" component={ComparePage} />
        <Route path="/support/new" component={SupportNewPage} />
        <Route path="/support/tickets/:ticketNumber" component={SupportTicketPage} />
        <Route path="/support" component={SupportHubPage} />
        <Route path="/blog/:slug" component={BlogPostPage} />
        <Route path="/blog" component={BlogPage} />
        <Route path="/business" component={BusinessPage} />
        <Route path="/survey/:token" component={SurveyPage} />
        <Route path="/faq" component={FaqPage} />
        <Route path="/newsletter/confirm" component={NewsletterConfirmPage} />
        <Route path="/newsletter/unsubscribe" component={NewsletterUnsubscribePage} />
        <Route component={StaticPageView} />
      </Switch>
      <ExitIntentPopup />
      <PurchaseToastProvider />
      <HreflangTags />
      <CookieBanner />
      <ConsentGatedScripts />
    </SiteLayout>
  );
}

function AppRouter() {
  const [location] = useLocation();
  const isAdmin = location === "/admin/accept-invite"
    ? false
    : location.startsWith("/admin");

  return isAdmin ? (
    <AdminRoot />
  ) : location === "/admin/accept-invite" ? (
    <AcceptInvitePage />
  ) : (
    <StorefrontWithMaintenance />
  );
}

function AppInitEffect() {
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    useThemeStore.getState().init();
    useCurrencyStore.getState().fetchRates();
    useFlashSaleStore.getState().load();
    useLoyaltyStore.getState().load();
  }, []);
  useEffect(() => {
    if (token) {
      useWishlistStore.getState().syncWithServer(token);
    }
  }, [token]);
  useEffect(() => {
    return useAuthStore.subscribe((state, prev) => {
      if (prev.token && !state.token) {
        useWishlistStore.getState().clearLocal();
      }
      if (state.user?.preferredTheme && state.user !== prev.user) {
        useThemeStore.getState().applyUserTheme();
      }
    });
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppInitEffect />
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

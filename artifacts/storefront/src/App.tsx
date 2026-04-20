import { lazy, Suspense, useEffect } from "react";
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
import {
  LogoutRoute,
  ToAboutUs,
  ToAffiliates,
  ToCookiePolicy,
  ToHowToBuy,
  ToOrderLookup,
  ToPrivacyPolicy,
} from "@/pages/legacy-routes";
import { useReferralTracking } from "@/hooks/use-referral";
import { ExitIntentPopup } from "@/components/newsletter/exit-intent-popup";
import { PurchaseToastProvider } from "@/components/social-proof/purchase-toast";
import { CompareBar } from "@/components/product/compare-bar";
import { RouteBreadcrumbJsonLd } from "@/components/seo/json-ld";

// Critical path — eager
import HomePage from "@/pages/home";
import ProductDetailPage from "@/pages/product-detail";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";

// Lazy-loaded pages
const ShopPage = lazy(() => import("@/pages/shop"));
const CategoryPage = lazy(() => import("@/pages/category"));
const OutletPage = lazy(() => import("@/pages/outlet"));
const HotOffersPage = lazy(() => import("@/pages/hot-offers"));
const BestSellersRedirect = lazy(() => import("@/pages/best-sellers"));
const NewArrivalsRedirect = lazy(() => import("@/pages/new-arrivals"));
const DealsPage = lazy(() => import("@/pages/deals"));
const FlashSalePage = lazy(() => import("@/pages/flash-sale"));
const BundlesPage = lazy(() => import("@/pages/bundles"));
const BundleDetailPage = lazy(() => import("@/pages/bundle-detail"));
const GiftCardsPage = lazy(() => import("@/pages/gift-cards"));
const AccountGiftCardsPage = lazy(() => import("@/pages/account-gift-cards"));
const AffiliatesPage = lazy(() => import("@/pages/affiliates"));
const AffiliateApplyPage = lazy(() => import("@/pages/affiliate-apply"));
const CartRecoverPage = lazy(() => import("@/pages/cart-recover"));
const SearchPage = lazy(() => import("@/pages/search"));
const OrderCompletePage = lazy(() => import("@/pages/order-complete"));
const OrderLookupPage = lazy(() => import("@/pages/order-lookup"));
const AccountOrdersPage = lazy(() => import("@/pages/account-orders"));
const AccountBalancePage = lazy(() => import("@/pages/account-balance"));
const AccountLoyaltyPage = lazy(() => import("@/pages/account-loyalty"));
const LoginPage = lazy(() => import("@/pages/login"));
const RegisterPage = lazy(() => import("@/pages/register"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const AuthGoogleSuccessPage = lazy(() => import("@/pages/auth-google-success"));
const AccountPage = lazy(() => import("@/pages/account"));
const WishlistPage = lazy(() => import("@/pages/wishlist"));
const ComparePage = lazy(() => import("@/pages/compare"));
const SupportHubPage = lazy(() => import("@/pages/support-hub"));
const SupportNewPage = lazy(() => import("@/pages/support-new"));
const SupportTicketPage = lazy(() => import("@/pages/support-ticket"));
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const BusinessPage = lazy(() => import("@/pages/business"));
const SurveyPage = lazy(() => import("@/pages/survey"));
const FaqPage = lazy(() => import("@/pages/faq"));
const StaticPageView = lazy(() => import("@/pages/static-page"));
const NewsletterConfirmPage = lazy(() => import("@/pages/newsletter-confirm"));
const NewsletterUnsubscribePage = lazy(() => import("@/pages/newsletter-unsubscribe"));
const AdminRoot = lazy(() => import("@/pages/admin/index"));
const AcceptInvitePage = lazy(() => import("@/pages/admin/accept-invite"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

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
      <Suspense>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/search" component={SearchPage} />
          <Route path="/shop" component={ShopPage} />
          <Route path="/category/:slug" component={CategoryPage} />
          <Route path="/outlet" component={OutletPage} />
          <Route path="/hot-offers" component={HotOffersPage} />
          <Route path="/best-sellers" component={BestSellersRedirect} />
          <Route path="/new-arrivals" component={NewArrivalsRedirect} />
          <Route path="/deals" component={DealsPage} />
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
          <Route path="/logout" component={LogoutRoute} />
          <Route path="/about" component={ToAboutUs} />
          <Route path="/privacy" component={ToPrivacyPolicy} />
          <Route path="/cookies" component={ToCookiePolicy} />
          <Route path="/orders" component={ToOrderLookup} />
          <Route path="/affiliate" component={ToAffiliates} />
          <Route path="/how-to-activate" component={ToHowToBuy} />
          <Route component={StaticPageView} />
        </Switch>
      </Suspense>
      <ExitIntentPopup />
      <PurchaseToastProvider />
      <CompareBar />
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

  return (
    <Suspense>
      {isAdmin ? (
        <AdminRoot />
      ) : location === "/admin/accept-invite" ? (
        <AcceptInvitePage />
      ) : (
        <StorefrontWithMaintenance />
      )}
    </Suspense>
  );
}

function AppInitEffect() {
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    useThemeStore.getState().init();
    // If visitor arrives via a feed link with ?currency=USD, honour it before fetching rates
    const urlCurrency = new URLSearchParams(window.location.search).get("currency");
    if (urlCurrency) {
      const store = useCurrencyStore.getState();
      const valid = ["USD","EUR","GBP","PLN","CZK","HUF","CAD","AUD","BRL","TRY"];
      if (valid.includes(urlCurrency.toUpperCase())) {
        store.setCode(urlCurrency.toUpperCase() as Parameters<typeof store.setCode>[0]);
      }
    }
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

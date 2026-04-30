export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  categoryLabel: string | null;
}

export const STATIC_FAQS: FaqItem[] = [
  // Orders & Delivery
  { id: 1, categoryLabel: "Orders & Delivery", question: "How do I receive my license key after purchase?", answer: "After your payment is confirmed, your license key is instantly available in your order confirmation page and sent to your email address. Check your spam/junk folder if you don't see it within a few minutes." },
  { id: 2, categoryLabel: "Orders & Delivery", question: "How long does delivery take?", answer: "Delivery is instant for all in-stock products. Your key appears in your account under My Orders and is emailed to you within seconds of payment confirmation." },
  { id: 3, categoryLabel: "Orders & Delivery", question: "I haven't received my key — what should I do?", answer: "First, check your spam or junk mail folder. Then log into your PixelCodes account and go to My Orders to view and copy your key directly. If the key still isn't there, open a support ticket and we'll resolve it immediately." },
  { id: 4, categoryLabel: "Orders & Delivery", question: "What do the different order statuses mean?", answer: "Pending — Payment is being processed.\nPaid — Payment confirmed, your key is ready.\nFulfilled — Key has been delivered to your email and account.\nFailed — Payment was not successful. You have not been charged." },
  { id: 5, categoryLabel: "Orders & Delivery", question: "My order has been processing for a long time — is this normal?", answer: "Most orders complete within seconds. If an order stays in 'Pending' for more than 10 minutes, contact our support team with your order number and we'll investigate immediately." },
  { id: 6, categoryLabel: "Orders & Delivery", question: "Can I purchase without creating an account?", answer: "Yes. You can check out as a guest — just provide your email address and your key will be sent there. We recommend creating a free account so you can always access your keys in My Orders, earn loyalty points, and track your history." },

  // License Keys
  { id: 7, categoryLabel: "License Keys", question: "Where can I find the key I purchased?", answer: "Your key is available in two places:\n1. In the order confirmation email sent to your address.\n2. In your account under My Account → Orders — click any order to reveal the full license key." },
  { id: 8, categoryLabel: "License Keys", question: "How do I activate my key?", answer: "Each product page includes step-by-step activation instructions. Generally: open the relevant platform (Windows Settings, Steam, Microsoft Store, etc.), navigate to the activation or 'Redeem a code' section, and enter your key exactly as shown — preferably by copy-pasting." },
  { id: 9, categoryLabel: "License Keys", question: "My key doesn't work — what should I do?", answer: "Try these steps:\n1. Copy and paste the key instead of typing manually — avoid extra spaces.\n2. Make sure you're activating in the correct region.\n3. Ensure your system meets the requirements.\n\nIf it still fails, contact support immediately. Do not attempt activation more than 3 times as repeated failures may lock the key." },
  { id: 10, categoryLabel: "License Keys", question: "Are the keys region-locked?", answer: "Some keys are region-specific (e.g., EU only, or Global). The product page clearly states any regional restrictions. Always verify your country is supported before purchasing." },
  { id: 11, categoryLabel: "License Keys", question: "I received a key for a different region — can I still use it?", answer: "Region-restricted keys can only be activated in their designated region. If you believe you received the wrong region key, contact support within 48 hours with your order number." },
  { id: 12, categoryLabel: "License Keys", question: "Can I use the key on multiple devices?", answer: "This depends on the license type. Most retail keys activate on one Microsoft/Steam account. The product description states if multiple activations are supported. When in doubt, contact us before purchase." },
  { id: 13, categoryLabel: "License Keys", question: "Are your keys genuine and legal?", answer: "Yes. All keys sold on PixelCodes are 100% genuine and sourced from authorized distributors. Every key is guaranteed to activate successfully on the first attempt." },

  // Payments
  { id: 14, categoryLabel: "Payments", question: "What payment methods do you accept?", answer: "We accept Visa, Mastercard, Apple Pay, and Google Pay. You can also pay using your PixelCodes wallet balance or redeem a gift card at checkout." },
  { id: 15, categoryLabel: "Payments", question: "Is my payment information secure?", answer: "Yes. All transactions are processed through a PCI-compliant payment gateway with 256-bit SSL encryption. We never store your full card details on our servers." },
  { id: 16, categoryLabel: "Payments", question: "Can I pay in my local currency?", answer: "Yes. PixelCodes supports EUR, USD, GBP, PLN, CZK, HUF, CAD, AUD, BRL, and TRY. Select your preferred currency from the currency selector in the top navigation bar." },
  { id: 17, categoryLabel: "Payments", question: "Why was my payment declined?", answer: "Common reasons: insufficient funds, card not enabled for online/international purchases, or your bank flagging a new merchant. Try a different card or contact your bank. You can also reach out to our support team for assistance." },
  { id: 18, categoryLabel: "Payments", question: "Do you offer discounts or coupon codes?", answer: "Yes. We run regular promotions and flash sales. Subscribe to our newsletter or check the Deals section for current offers. You can also use coupon codes at checkout — enter the code in the coupon field in your cart." },

  // Account
  { id: 19, categoryLabel: "Account", question: "How do I view my order history?", answer: "Log into your PixelCodes account and go to My Account → Orders. All your purchases are listed there with full details and license keys accessible at any time." },
  { id: 20, categoryLabel: "Account", question: "How do loyalty points work?", answer: "You earn points on every purchase (points per euro/dollar spent). At checkout, use the loyalty points slider to redeem points as a discount on your order. Points never expire as long as your account remains active." },
  { id: 21, categoryLabel: "Account", question: "I forgot my password — how do I reset it?", answer: "Click 'Forgot Password' on the login page and enter your email address. You will receive a reset link within a few minutes. Check your spam folder if it doesn't arrive." },
  { id: 22, categoryLabel: "Account", question: "Can I sign in with Google?", answer: "Yes. Click 'Sign in with Google' on the login or registration page to create or access your account using your Google credentials — no separate password needed." },

  // Refunds & Support
  { id: 23, categoryLabel: "Refunds & Support", question: "What is your refund policy?", answer: "If your key fails to activate despite following the activation instructions correctly, contact our support team within 15 days of purchase. We will provide a working replacement key or a full refund. Keys that have been successfully activated are non-refundable." },
  { id: 24, categoryLabel: "Refunds & Support", question: "My key was already used by someone else — what can I do?", answer: "This is extremely rare as keys are delivered exclusively to you after purchase. Contact our support team immediately with your order number. We will investigate and provide a replacement at no cost." },
  { id: 25, categoryLabel: "Refunds & Support", question: "How do I contact customer support?", answer: "Open a support ticket from the Support page or use the live chat widget on the site. Our team responds within a few hours during business hours (Monday–Friday, 9am–6pm CET)." },
  { id: 26, categoryLabel: "Refunds & Support", question: "How do I leave a review?", answer: "After your key is delivered you'll receive a Trustpilot review invitation by email. You can also go directly to our Trustpilot page to share your experience. We read every review and appreciate your feedback." },
];

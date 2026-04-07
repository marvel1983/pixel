import { z } from "zod";
import type { BillingData } from "@/components/checkout/billing-form";
import type { PaymentData } from "@/components/checkout/payment-form";

const billingSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().min(1, "Address is required"),
  zip: z.string().min(1, "Zip code is required"),
});

const paymentSchema = z.object({
  cardName: z.string().min(1, "Name on card is required"),
  cardNumber: z.string().transform(v => v.replace(/\s/g, "")).pipe(z.string().min(13, "Valid card number is required").max(16)),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, "Valid expiry (MM/YY) is required"),
  cvc: z.string().min(3, "Valid CVC is required").max(4),
});

export function validateBilling(data: BillingData) {
  const result = billingSchema.safeParse(data);
  if (result.success) return { valid: true as const, errors: {} };
  const errors: Partial<Record<keyof BillingData, string>> = {};
  result.error.issues.forEach((issue) => {
    const key = issue.path[0] as keyof BillingData;
    if (!errors[key]) errors[key] = issue.message;
  });
  return { valid: false as const, errors };
}

export function validatePayment(data: PaymentData) {
  const result = paymentSchema.safeParse(data);
  if (result.success) return { valid: true as const, errors: {} };
  const errors: Partial<Record<keyof PaymentData, string>> = {};
  result.error.issues.forEach((issue) => {
    const key = issue.path[0] as keyof PaymentData;
    if (!errors[key]) errors[key] = issue.message;
  });
  return { valid: false as const, errors };
}

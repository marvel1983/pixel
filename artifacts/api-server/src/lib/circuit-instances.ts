import { CircuitBreaker } from "./circuit-breaker";

export const metenziCircuit = new CircuitBreaker({
  name: "metenzi",
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenTestIntervalMs: 60_000,
});

export const stripeCircuit = new CircuitBreaker({
  name: "stripe",
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenTestIntervalMs: 60_000,
});

export const trustpilotCircuit = new CircuitBreaker({
  name: "trustpilot",
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenTestIntervalMs: 120_000,
});

export const mailchimpCircuit = new CircuitBreaker({
  name: "mailchimp",
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenTestIntervalMs: 120_000,
});

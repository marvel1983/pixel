import { db } from "@workspace/db";
import { auditLog } from "@workspace/db/schema";
import { logger } from "./logger";
import { enqueueJob } from "./job-queue";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenTestIntervalMs: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, "name"> = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenTestIntervalMs: 60_000,
};

interface CircuitInfo {
  state: CircuitState;
  failures: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
  lastSuccessAt: number | null;
  lastError: string | null;
}

const registry = new Map<string, CircuitBreaker>();

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private lastFailureAt: number | null = null;
  private lastStateChangeAt = Date.now();
  private lastSuccessAt: number | null = null;
  private lastError: string | null = null;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<CircuitBreakerConfig>;
    if (!this.config.onStateChange) {
      this.config.onStateChange = () => {};
    }
    registry.set(this.config.name, this);
  }

  get name(): string {
    return this.config.name;
  }

  getInfo(): CircuitInfo {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureAt: this.lastFailureAt,
      lastStateChangeAt: this.lastStateChangeAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
    };
  }

  async exec<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastStateChangeAt >= this.config.resetTimeoutMs) {
        this.transition("HALF_OPEN");
      } else {
        if (fallback) return fallback();
        throw new CircuitOpenError(this.config.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      if (this.state === "OPEN" && fallback) {
        return fallback();
      }
      throw err;
    }
  }

  reset(): void {
    const prev = this.state;
    this.state = "CLOSED";
    this.failures = 0;
    this.lastError = null;
    this.lastStateChangeAt = Date.now();
    if (prev !== "CLOSED") {
      this.logStateChange(prev, "CLOSED", "manual_reset");
    }
  }

  private onSuccess(): void {
    this.lastSuccessAt = Date.now();
    if (this.state === "HALF_OPEN") {
      this.transition("CLOSED");
    }
    this.failures = 0;
  }

  private onFailure(err: unknown): void {
    this.failures++;
    this.lastFailureAt = Date.now();
    this.lastError = err instanceof Error ? err.message : String(err);

    if (this.state === "HALF_OPEN") {
      this.transition("OPEN");
      return;
    }

    if (this.state === "CLOSED" && this.failures >= this.config.failureThreshold) {
      this.transition("OPEN");
    }
  }

  private transition(to: CircuitState): void {
    const from = this.state;
    this.state = to;
    this.lastStateChangeAt = Date.now();
    if (from === to) return;

    logger.warn({ service: this.config.name, from, to, failures: this.failures }, "Circuit breaker state change");
    this.logStateChange(from, to, "automatic");
    this.config.onStateChange!(from, to);

    if (to === "OPEN") {
      this.sendAdminAlert(from).catch((e) =>
        logger.error({ err: e }, "Failed to enqueue circuit breaker alert"),
      );
    }
  }

  private logStateChange(from: CircuitState, to: CircuitState, trigger: string): void {
    db.insert(auditLog).values({
      action: "SETTINGS_CHANGE",
      entityType: "circuit_breaker",
      details: {
        service: this.config.name,
        from,
        to,
        trigger,
        failures: this.failures,
        lastError: this.lastError,
      },
    }).catch((e) => logger.error({ err: e }, "Failed to log circuit state change"));
  }

  private async sendAdminAlert(from: CircuitState): Promise<void> {
    await enqueueJob({
      queue: "email",
      name: "circuit-breaker-alert",
      priority: 3,
      maxAttempts: 3,
      payload: {
        service: this.config.name,
        from,
        to: "OPEN",
        failures: this.failures,
        lastError: this.lastError,
      },
    });
  }
}

export class CircuitOpenError extends Error {
  public readonly service: string;
  constructor(service: string) {
    super(`Circuit breaker OPEN for ${service}`);
    this.service = service;
    this.name = "CircuitOpenError";
  }
}

export function getCircuitBreaker(name: string): CircuitBreaker | undefined {
  return registry.get(name);
}

export function getAllCircuitBreakers(): Map<string, CircuitBreaker> {
  return registry;
}

export function getAllCircuitStatus(): Record<string, CircuitInfo> {
  const result: Record<string, CircuitInfo> = {};
  for (const [name, cb] of registry) {
    result[name] = cb.getInfo();
  }
  return result;
}

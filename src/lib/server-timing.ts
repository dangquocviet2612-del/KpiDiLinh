const PHASES = ["auth", "schema", "scope", "date", "query", "compute", "serialize", "total", "cache"] as const;

export type ServerTimingPhase = typeof PHASES[number];

export class ServerTiming {
  private readonly startedAt: number;
  private readonly durations = new Map<ServerTimingPhase, number>();
  private cacheStatus?: "hit" | "miss";

  constructor(private readonly now: () => number = () => performance.now()) {
    this.startedAt = now();
  }

  async measure<Value>(phase: ServerTimingPhase, operation: () => Value | PromiseLike<Value>): Promise<Value> {
    this.validatePhase(phase);
    const startedAt = this.now();
    try {
      return await operation();
    } finally {
      this.record(phase, startedAt);
    }
  }

  measureSync<Value>(phase: ServerTimingPhase, operation: () => Value): Value {
    this.validatePhase(phase);
    const startedAt = this.now();
    try {
      return operation();
    } finally {
      this.record(phase, startedAt);
    }
  }

  setCacheStatus(status: "hit" | "miss") {
    if (status !== "hit" && status !== "miss") {
      throw new Error("Invalid Server-Timing cache status");
    }
    this.cacheStatus = status;
  }

  toHeader(): string {
    const elapsed = this.now() - this.startedAt;
    const total = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    return PHASES.flatMap((phase) => {
      const duration = phase === "total" ? total : this.durations.get(phase);
      if (duration === undefined) return [];
      const description = phase === "cache" && this.cacheStatus ? `;desc="${this.cacheStatus}"` : "";
      return [`${phase};dur=${duration.toFixed(2)}${description}`];
    }).join(", ");
  }

  applyTo<ResponseType extends Response>(response: ResponseType): ResponseType {
    response.headers.set("Server-Timing", this.toHeader());
    return response;
  }

  private validatePhase(phase: ServerTimingPhase) {
    if (!PHASES.includes(phase)) throw new Error("Invalid Server-Timing phase");
  }

  private record(phase: ServerTimingPhase, startedAt: number) {
    const elapsed = this.now() - startedAt;
    if (!Number.isFinite(elapsed)) return;
    const duration = (this.durations.get(phase) ?? 0) + Math.max(0, elapsed);
    if (Number.isFinite(duration)) this.durations.set(phase, duration);
  }
}

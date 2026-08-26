interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

interface WakeLockApiLike {
  request(type: "screen"): Promise<WakeLockSentinelLike>;
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: WakeLockApiLike;
};

export class WakeLockController {
  private desired = false;
  private sentinel: WakeLockSentinelLike | null = null;
  private requestInFlight = false;
  private destroyed = false;

  async setEnabled(enabled: boolean): Promise<void> {
    this.desired = enabled;

    if (!enabled) {
      await this.release();
      return;
    }

    await this.acquire();
  }

  async handleVisibilityChange(): Promise<void> {
    if (this.desired && document.visibilityState === "visible") {
      await this.acquire();
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    this.desired = false;
    await this.release();
  }

  private async acquire(): Promise<void> {
    if (this.destroyed || !this.desired || this.sentinel !== null || this.requestInFlight) {
      return;
    }

    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock || document.visibilityState !== "visible") {
      return;
    }

    try {
      this.requestInFlight = true;
      const sentinel = await wakeLock.request("screen");
      if (this.destroyed || !this.desired) {
        await sentinel.release();
        return;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener("release", () => {
        if (this.sentinel === sentinel) {
          this.sentinel = null;
        }
      });
    } catch {
      this.sentinel = null;
    } finally {
      this.requestInFlight = false;
    }
  }

  private async release(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;

    if (sentinel !== null) {
      try {
        await sentinel.release();
      } catch {
        // A revoked wake lock is already released; no user action is required.
      }
    }
  }
}

export type HealthState = { status: "online" | "offline"; detail: string };

/** Backend is intentionally launched separately in milestone 0.3. */
export async function getBackendHealth(signal?: AbortSignal): Promise<HealthState> {
  try {
    const response = await fetch("http://127.0.0.1:8000/api/v1/system/health", { signal, cache: "no-store" });
    if (!response.ok) return { status: "offline", detail: `HTTP ${response.status}` };
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "status" in body && body.status === "ready") {
      return { status: "online", detail: "Local backend ready" };
    }
    return { status: "offline", detail: "Unexpected health response" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "offline", detail: "Backend not running" };
  }
}

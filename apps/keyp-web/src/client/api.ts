import { runRequestSchema, type RunRequest, type RunResponse } from "../shared/contracts";

export async function createRun(
  request: RunRequest,
  signal?: AbortSignal,
): Promise<RunResponse> {
  const body = runRequestSchema.parse(request);
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await response.json()) as RunResponse | { message?: string };
  if (!response.ok) {
    throw new Error(
      "message" in payload && payload.message
        ? payload.message
        : "KeyP could not complete this run.",
    );
  }
  return payload as RunResponse;
}

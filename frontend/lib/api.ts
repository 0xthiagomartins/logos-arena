import { getOrCreateAnonymousClientId } from "@/lib/client-id";

export type DebateStatus = "draft" | "queued" | "running" | "paused" | "completed" | "failed";

export type DebateListItem = {
  id: string;
  title: string;
  question: string;
  status: DebateStatus;
  created_at: string;
};

export type DebateListResponse = {
  items: DebateListItem[];
  total: number;
  page: number;
  per_page: number;
};

export type DebateResponse = {
  id: string;
  status: DebateStatus;
  title: string;
  question: string;
  config_json: Record<string, unknown>;
  current_round_index: number;
  created_at: string;
  updated_at: string;
};

export type RoundMessage = {
  role: "debater_a" | "debater_b" | "mediator" | string;
  content: string;
};

export type RoundResponse = {
  index: number;
  type: "opening" | "rebuttal" | "closing" | string;
  messages: RoundMessage[];
};

export type DebateRoundsResponse = {
  rounds: RoundResponse[];
  round_summaries: string[];
};

export type ReportResponse = {
  content_md: string;
};

export type StepRoundResponse = {
  step_type: "round";
  round_index: number;
  round: RoundResponse;
  step_summary: string;
};

export type StepMediationResponse = {
  step_type: "mediation";
  report: ReportResponse;
  status: DebateStatus;
};

export type StepResponse = StepRoundResponse | StepMediationResponse;

export type StepStreamEvent =
  | { event: "phase"; data: { phase: string; round_index?: number; round_type?: string } }
  | { event: "message_start"; data: { target: "debater_a" | "debater_b" | "step_summary" | "report"; round_index?: number; round_type?: string } }
  | { event: "message_chunk"; data: { target: "debater_a" | "debater_b" | "step_summary" | "report"; chunk: string } }
  | { event: "message_end"; data: { target: "debater_a" | "debater_b" | "step_summary" | "report" } }
  | { event: "step_done"; data: Record<string, unknown> }
  | { event: "error"; data: { detail: string; code: string } }
  | { event: "done"; data: { ok: boolean } };

type CreateDebatePayload = {
  title: string;
  question: string;
  config?: {
    question?: string;
    language?: string;
    rounds?: string[];
    max_tokens_per_message?: number;
    mediator_prefs?: {
      explain_like_12yo?: boolean;
      rigor_formal?: boolean;
      point_out_fallacies?: boolean;
      steelman_other_side?: boolean;
    };
  };
};

type ApiRequestOptions = {
  token?: string | null;
  clientId?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function normalizeErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (typeof detail === "object" && detail !== null) {
      const nested = (detail as { detail?: unknown }).detail;
      if (typeof nested === "string") return nested;
    }
  }
  return fallback;
}

function buildApiHeaders(initHeaders?: HeadersInit, options?: ApiRequestOptions): Headers {
  const headers = new Headers(initHeaders);
  headers.set("Content-Type", "application/json");

  const clientId =
    options?.clientId ?? (typeof window !== "undefined" ? getOrCreateAnonymousClientId() : null);
  if (clientId) {
    headers.set("X-Client-Id", clientId);
  }

  if (options?.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }
  return headers;
}

async function apiRequest<T>(path: string, init?: RequestInit, options?: ApiRequestOptions): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildApiHeaders(init?.headers, options),
    cache: "no-store",
  });

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    throw new Error(normalizeErrorMessage(payload, `Erro HTTP ${res.status}`));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function listDebates(page = 1, perPage = 20): Promise<DebateListResponse> {
  return apiRequest<DebateListResponse>(`/debates?page=${page}&per_page=${perPage}`);
}

export function createDebate(payload: CreateDebatePayload, options?: ApiRequestOptions): Promise<DebateResponse> {
  return apiRequest<DebateResponse>("/debates", {
    method: "POST",
    body: JSON.stringify(payload),
  }, options);
}

export function getDebate(debateId: string): Promise<DebateResponse> {
  return apiRequest<DebateResponse>(`/debates/${debateId}`);
}

export function deleteDebate(debateId: string): Promise<void> {
  return apiRequest<void>(`/debates/${debateId}`, {
    method: "DELETE",
  });
}

export function getDebateRounds(debateId: string): Promise<DebateRoundsResponse> {
  return apiRequest<DebateRoundsResponse>(`/debates/${debateId}/rounds`);
}

export function getDebateReport(debateId: string): Promise<ReportResponse> {
  return apiRequest<ReportResponse>(`/debates/${debateId}/report`);
}

export function runDebateStep(debateId: string): Promise<StepResponse> {
  return apiRequest<StepResponse>(`/debates/${debateId}/step`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function runDebateStepStream(
  debateId: string,
  onEvent: (event: StepStreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/debates/${debateId}/step/stream`, {
    method: "POST",
    headers: buildApiHeaders(),
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new Error(normalizeErrorMessage(payload, `Erro HTTP ${response.status}`));
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let currentEvent = "message";

  const dispatchBlock = (block: string) => {
    const lines = block.split("\n");
    let eventName = currentEvent;
    let dataStr = "";
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataStr += line.slice(5).trim();
      }
    }
    currentEvent = eventName;
    if (!dataStr) return;
    const parsed = JSON.parse(dataStr) as Record<string, unknown>;
    onEvent({ event: eventName as StepStreamEvent["event"], data: parsed } as StepStreamEvent);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      if (block.trim()) dispatchBlock(block);
    }
  }

  if (buffer.trim()) {
    dispatchBlock(buffer);
  }
}

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

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

  return (await res.json()) as T;
}

export function listDebates(page = 1, perPage = 20): Promise<DebateListResponse> {
  return apiRequest<DebateListResponse>(`/debates?page=${page}&per_page=${perPage}`);
}

export function createDebate(payload: CreateDebatePayload): Promise<DebateResponse> {
  return apiRequest<DebateResponse>("/debates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDebate(debateId: string): Promise<DebateResponse> {
  return apiRequest<DebateResponse>(`/debates/${debateId}`);
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

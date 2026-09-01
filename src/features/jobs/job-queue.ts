export type JobType =
  | "discover_leads"
  | "analyze_profile"
  | "score_lead"
  | "send_instagram_dm"
  | "process_instagram_reply"
  | "process_whatsapp_reply"
  | "schedule_followup"
  | "run_experiment"
  | "recalculate_scores"
  | "sync_metrics";

export type JobRecord = {
  id: string;
  type: JobType;
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
  lockedUntil: Date | null;
  status: "queued" | "running" | "completed" | "dead";
};

export function canRunJob(job: JobRecord, now = new Date()): boolean {
  return job.status === "queued" && (!job.lockedUntil || job.lockedUntil <= now) && job.attempts < job.maxAttempts;
}

export function markJobFailure(job: JobRecord): JobRecord {
  const attempts = job.attempts + 1;
  return {
    ...job,
    attempts,
    status: attempts >= job.maxAttempts ? "dead" : "queued",
    lockedUntil: null,
  };
}

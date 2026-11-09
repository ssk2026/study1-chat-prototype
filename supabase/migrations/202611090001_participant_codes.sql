create table if not exists public.participant_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{8,32}$' and code = upper(code)),
  status text not null default 'issued' check (status in ('issued', 'started', 'task_completed', 'withdrawn')),
  task_code text not null default 'TASK_1_DESERT',
  condition_code text not null default 'B_AI_COLLABORATIVE_PREDICTION',
  session_id uuid unique references public.sessions(id) on delete set null,
  consented_at timestamptz,
  consent_version text,
  started_at timestamptz,
  completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.participant_codes enable row level security;
revoke all on table public.participant_codes from anon, authenticated;

comment on table public.participant_codes is 'Server-only issued participant codes and their Study 1 session linkage.';
comment on column public.participant_codes.code is 'Uppercase, high-entropy pseudonymous code distributed by the research team.';

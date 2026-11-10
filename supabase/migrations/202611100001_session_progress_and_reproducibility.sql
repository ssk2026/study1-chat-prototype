alter table public.sessions
  add column if not exists current_stage text not null default 'intro'
    check (current_stage in ('intro', 'tutorial', 'initial_ranking', 'collaboration', 'complete')),
  add column if not exists stage_started_at timestamptz,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists prompt_version text not null default 'unversioned',
  add column if not exists model_config jsonb not null default '{}'::jsonb;

alter table public.task1_rankings
  add column if not exists initial_draft_ranking text[],
  add column if not exists initial_draft_rationales jsonb not null default '{}'::jsonb,
  add column if not exists current_ranking text[],
  add column if not exists ai_ranking_generation_version text,
  add column if not exists discussion_turns integer not null default 0;

create index if not exists sessions_status_last_seen_idx
  on public.sessions(status, last_seen_at desc);

comment on column public.sessions.current_stage is 'Server-restored participant workflow stage.';
comment on column public.sessions.stage_started_at is 'Server timestamp used to restore the active stage timer.';
comment on column public.sessions.prompt_version is 'Version label for the system prompt used in this session.';
comment on column public.sessions.model_config is 'Model ID and generation parameters fixed for reproducibility.';
comment on column public.task1_rankings.initial_draft_ranking is 'Autosaved ranking before initial submission.';
comment on column public.task1_rankings.current_ranking is 'Autosaved working final ranking during AI conversation.';

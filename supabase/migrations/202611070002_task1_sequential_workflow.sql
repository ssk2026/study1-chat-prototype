alter table public.task1_rankings
  add column if not exists initial_rationales jsonb not null default '{}'::jsonb,
  add column if not exists consensus_ranking text[],
  add column if not exists item_decisions jsonb not null default '[]'::jsonb;

comment on column public.task1_rankings.initial_rationales is 'Optional participant rationale for each item before AI rankings are revealed.';
comment on column public.task1_rankings.consensus_ranking is 'Working ranking produced during the sequential collaboration phase.';
comment on column public.task1_rankings.item_decisions is 'Per-item discussion completion, ranks, and decision timestamps.';

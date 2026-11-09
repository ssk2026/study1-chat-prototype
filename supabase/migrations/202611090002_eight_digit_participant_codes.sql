update public.participant_codes
set code = '90000001'
where code = 'TEST-9K7M-2Q4X'
  and status = 'issued'
  and session_id is null;

alter table public.participant_codes
  drop constraint if exists participant_codes_code_check;

alter table public.participant_codes
  add constraint participant_codes_code_check
  check (code ~ '^[0-9]{8}$');

comment on column public.participant_codes.code is 'Exactly eight numeric digits, distributed as a pseudonymous platform access code.';

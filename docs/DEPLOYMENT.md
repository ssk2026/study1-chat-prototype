# GitHub + Supabase + Vercel deployment

## 1. Create a private GitHub repository

Create an empty private repository, for example `study1-ai-dialogue-platform`, without a README or `.gitignore. Then add it as a remote and push `main`.

## 2. Create and initialize Supabase

1. Create a Supabase project in the region approved for the study.
2. Open **SQL Editor** and run every file in `supabase/migrations/` in filename order. Existing projects should apply only the newer, unapplied migrations.
3. Copy the project URL and a current `sb_secret_...` server-side secret key from **Settings → API Keys**.
4. Never expose the secret or legacy `service_role` key in browser code.

## 3. Import the GitHub repository into Vercel

Use the **Other** framework preset and leave build/output settings at their defaults. The repository's `vercel.json` serves the existing `dist/` UI and deploys the files under `api/` as Vercel Functions.

Add these Production, Preview, and Development environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` — pin the exact model ID selected for the preregistered study
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` — use the current `sb_secret_...` key; keep it server-side
- `STUDY_VERSION`

Deploy, then check `/api/health`. Both `configured.openai` and `configured.supabase` must be `true` before participant access is enabled.

## 4. Research launch checklist

- Apply IRB-approved consent, privacy, withdrawal, retention, and debrief text.
- Use anonymous participant codes; keep recruitment/contact data in a separate system.
- Pin and record the OpenAI model ID and system-prompt version.
- Test duplicate submissions, interrupted sessions, mobile browsers, and failed API calls.
- Restrict Supabase dashboard access and rotate secrets if they are ever disclosed.
- Export and verify a small pilot dataset before recruitment begins.


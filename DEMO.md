# Demo Setup

For recording a portfolio demo, or local QA/testing, without touching real account data in the production Supabase project.

## Simplest: dedicated test user, same Supabase project

All app data is scoped by `user_id`, so a test account in the *same* project is fully row-isolated from real users — no separate infra needed. Good default for local QA.

1. In Supabase Studio → Authentication → Users → "Add user": set a test email/password, enable "Auto Confirm User" (skips the email-confirmation round trip), create it, and copy the generated user UUID.
2. Seed demo data for that user:
   ```bash
   cd server
   DEMO_USER_ID=<uuid-from-step-1> python seed_demo.py
   ```
3. Store the email/password/UUID somewhere gitignored (e.g. a root-level `.env.test` — `.env.*` is already in `.gitignore`) so they don't need to be re-created each time.
4. Run the app normally (`python server.py` + `npm run dev`) and log in with the test credentials.

To reset and re-seed at any time:
```bash
DEMO_USER_ID=<uuid> python seed_demo.py --clear
```

If full infrastructure isolation from the production project is needed instead (e.g. for a public demo recording), use one of the two options below.

## Full isolation: separate Supabase project

1. Create a free Supabase project at supabase.com (call it "tally-demo")
2. Copy credentials into `client/.env.local`:
   ```
   VITE_SUPABASE_URL=https://<demo-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   ```
3. Add to `server/.env` (or export):
   ```
   DATABASE_URL=postgresql://postgres:<password>@db.<demo-project>.supabase.co:5432/postgres
   SUPABASE_JWT_SECRET=<jwt-secret>
   OPENAI_API_KEY=<your-key>
   ```
4. Sign up for a new account on the demo project, copy the user UUID from Supabase Auth dashboard
5. Seed demo data:
   ```bash
   cd server
   DEMO_USER_ID=<uuid-from-step-4> python seed_demo.py
   ```
6. Run the app normally (`python server.py` + `npm run dev`) and record

To reset and re-seed at any time:
```bash
DEMO_USER_ID=<uuid> python seed_demo.py --clear
```

## Alternative: Local Supabase CLI

```bash
supabase start    # starts local Postgres + auth at localhost
# Use the printed local anon key, JWT secret, and DB URL
# Then follow steps 4-6 above
```

## What the seed script creates

- 5 months of expenses/income across 6 categories, dated relative to whenever the script runs — the 5 full calendar months immediately preceding the current one; the current month is left empty (e.g. for testing zero-income/zero-spend states)
- 4 statistical outliers that trigger anomaly detection
- "Europe Trip" goal at-risk: $500 saved of $3,000, deadline ~4 months after the last seeded month
- Emergency fund + monthly savings goal
- Import rules and budget limits per category

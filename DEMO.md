# Demo Setup

For recording a portfolio demo locally without touching the production Supabase project.

## Recommended: Separate Supabase project

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

- 5 months of expenses (Jan–May 2026) across 6 categories
- 4 statistical outliers that trigger anomaly detection
- "Europe Trip" goal at-risk: $500 saved of $3,000, deadline Sep 2026
- Emergency fund + monthly savings goal
- Import rules and budget limits per category

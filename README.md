# Tally

A full-stack personal finance app with AI-powered insights. Track expenses and income, set category budgets, monitor savings goals, and get proactive financial coaching.

---

## Features

### Core
- **Expense & income tracking** — add, edit, delete; recurring entries seed future months automatically
- **Import** — CSV, Excel, and PDF bank statements with smart auto-categorization
- **Custom categories** — expense types with color + icon, grouped into macrocategories with optional group budget limits
- **Budgets** — per-category monthly limits with per-month overrides; two-tone progress bars show actual vs projected spend
- **Savings goals** — monthly targets, one-time goals, and emergency fund; projected completion, allocation by % slice or priority cascade, pause/resume
- **Spending analysis** — budget pacing, category trends, z-score outlier detection, month-over-month summaries

### AI
- **Proactive insights** — observations surfaced on dashboard load from pacing data, outliers, and goal progress
- **Natural language entry** — describe an expense in plain text and have it parsed into structured fields
- **Receipt OCR** — photograph or upload a receipt; GPT-4o vision extracts merchant, amount, and date
- **Smart import categorization** — AI classifies uncategorized rows during import
- **Budget recommendations** — 3-month spending history → suggested per-category limits with rationale
- **Anomaly explainer** — expand any flagged outlier to understand whether it was a one-off event, a frequency spike, or a new habit forming
- **Goal deadline coach** — at-risk savings goals surface 3 concrete options (cut a spending category, extend the deadline, reduce the target) grounded in real numbers
- **AI chat** — conversational agent with tools: budget status, savings progress, category breakdown, outlier detection, semantic transaction search

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · Vite · Tailwind CSS · Recharts · TanStack Query |
| Backend | FastAPI · Python |
| Auth | Supabase Auth (email/password + Google OAuth) |
| AI | OpenAI gpt-4o / gpt-4o-mini · LangGraph |
| Import | pdfplumber · openpyxl |
| Desktop | PyInstaller · GitHub Actions (macOS + Windows builds) |

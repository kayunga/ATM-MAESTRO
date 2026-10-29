# jobcards - TechMasters ATM Job Card System

React (Vite) + Vercel serverless functions (`/api`) + its own PostgreSQL database. Independent of the Laravel app.

## UI only (no DB, no API)
`npm install && npm run dev:ui` -> http://localhost:5173 (sample data in memory; admin tab included)

## Run locally with a real database
1. Install PostgreSQL 16 (or `docker compose up -d`), create an empty database `jobcards`.
2. `cp .env.example .env` and set `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. `npm install`
4. `npm run db:migrate` (creates tables) then `npm run db:seed` (first admin; `SEED_SAMPLE=1` adds sample ATMs)
5. `npm run dev` -> http://localhost:5173. Sign in with the admin; you must set a new password first.

## Getting your 300+ ATMs in
Admin -> ATMs -> **Import CSV** (columns: terminal_id, bank, location, model, serial_number, address, has_gbna (yes/no); use *Template*).
Tick **GBNA fitted** on an ATM (or set has_gbna in the CSV) and its preventive maintenance cards include the GBNA checks; other ATMs never show them.
From the Laravel DB: `\copy (SELECT a.terminal_id, b.short_code AS bank, a.location, a.model, a.serial_number, a.address FROM atms a LEFT JOIN banks b ON b.id=a.bank_id WHERE a.deleted_at IS NULL) TO 'atms.csv' CSV HEADER`
Re-importing is safe: existing terminal IDs are updated, not duplicated.

## Deploy (Vercel + Supabase/Neon)
1. New Supabase (or Neon) project, dedicated to this app. Use Pro for production (free tier pauses).
2. Run `npm run db:migrate` and `npm run db:seed` with `DATABASE_URL` pointing at it, then (Supabase only) run `db/03_lock_public_tables.sql`.
3. Vercel env vars: `DATABASE_URL` (transaction pooler, port 6543), `SESSION_SECRET` (32+ chars).
4. `vercel --prod`. Vercel Hobby is non-commercial; use Pro for company use.

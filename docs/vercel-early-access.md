# Deploy ATM Maestro to Vercel (free tier)

ATM Maestro runs on Vercel's **Container Runtime** (Beta, available on the
free Hobby plan) using the repo's `Dockerfile` + FrankenPHP. The database is a
free hosted PostgreSQL: **Neon (recommended)** or **Supabase**.

Every push to `main` deploys Production; other branches/PRs get Preview URLs.

| File | Purpose |
| --- | --- |
| [Dockerfile](../Dockerfile) | Builds PHP deps + Vite assets, runs FrankenPHP |
| [Caddyfile](../Caddyfile) | Serves `public/` on Vercel's `PORT` |
| [docker/start-container.sh](../docker/start-container.sh) | Creates `/tmp` storage dirs, starts the server |
| [vercel.json](../vercel.json) | Tells Vercel to build the Dockerfile as a container |
| [.github/workflows/migrate.yml](../.github/workflows/migrate.yml) | Runs migrations/seeding from GitHub |

---

## 1. Import the GitHub repo into Vercel

1. Push this repo to GitHub (`main`).
2. In Vercel: **Add New → Project**, import `ATM-MAESTRO`.
3. Root Directory `./`. Leave Build/Install/Output overrides **empty**.
4. Framework preset: choose **Container** (or **Other**). Vercel may suggest
   *Vite* — don't use it. If the wrong preset sticks, fix it from the CLI:

   ```sh
   npm i -g vercel
   vercel link
   vercel project update --framework container --yes
   ```

5. Click **Deploy**. The first deploy will build but won't work until steps
   2–3 are done; you'll redeploy afterwards.

## 2. Create the database

### Option A — Neon (recommended)

1. Vercel project → **Storage → Create Database → Neon** (free plan).
2. Connect it to the project for **Production** and **Preview**, with
   **no custom prefix**. Leave "create database branch for Preview" on so
   previews never touch production data.
3. Neon adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` to the
   project. The app reads `DATABASE_URL` automatically — nothing to copy.

### Option B — Supabase

1. Vercel project → **Storage → Supabase** (or create a project on
   supabase.com and connect it).
2. The integration adds `POSTGRES_URL` (transaction pooler, port 6543), which
   the app reads automatically. Also add this variable (see step 3):

   ```text
   DB_EMULATE_PREPARES=true
   ```

   The transaction pooler doesn't support server-side prepared statements;
   this setting makes Laravel work with it.

If you connect a database manually instead of via an integration, set
`DB_URL` to its pooled connection string.

## 3. Set environment variables

Generate an app key locally (keep it secret, never commit it):

```sh
php artisan key:generate --show
```

Vercel → **Settings → Environment Variables**, scope **Production**:

```text
APP_KEY=base64:...            (from the command above, mark Sensitive)
APP_URL=https://<your-project>.vercel.app
```

That's all that's required. The Dockerfile already sets
`APP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr`,
`SESSION_DRIVER=database`, `CACHE_STORE=database`, `QUEUE_CONNECTION=sync`.
Override any of them here if needed.

For Preview deployments, add a **different** `APP_KEY` scoped to Preview.

## 4. Run migrations (and seed) from GitHub

No local PHP/Postgres setup required.

1. GitHub repo → **Settings → Secrets and variables → Actions → New
   repository secret**:

   | Secret | Value |
   | --- | --- |
   | `PRODUCTION_DATABASE_URL` | Neon: value of `DATABASE_URL_UNPOOLED`. Supabase: **Connect → Session pooler** string (port 5432). |
   | `PGSSEED_ADMIN_PASSWORD` | Strong password, 12+ chars (only for seeding) |
   | `PGSSEED_ENGINEER_PASSWORD` | Different strong password (only for seeding) |

   Get the Neon/Supabase connection string from the provider dashboard
   (Vercel → Storage → your DB → *Open in Neon/Supabase*).

2. GitHub → **Actions → migrate database → Run workflow**. Tick **seed** the
   first time to create the early-access accounts.

After that, the workflow runs automatically whenever a push to `main`
changes `database/migrations/`.

The seeder creates one admin, three engineers, one bank, three ATMs and three
calls, and is safe to re-run:

- Admin: `early-access-admin@example.com`
- Engineers: `lusaka.engineer@example.com`, `copperbelt.engineer@example.com`,
  `southern.engineer@example.com`

Change these passwords after first login.

<details>
<summary>Alternative: run migrations from your machine</summary>

Requires PHP 8.3+ with `pdo_pgsql` (Herd includes it). In PowerShell, from
the repo root (shell variables override your local `.env`):

```powershell
$env:DB_CONNECTION = 'pgsql'
$env:DB_URL = '<unpooled connection string>'
php artisan migrate --force
# first time only:
$env:PGSSEED_ADMIN_PASSWORD = '<strong password>'
$env:PGSSEED_ENGINEER_PASSWORD = '<different strong password>'
php artisan db:seed --class=Pgsseeder --force
```

Close the terminal afterwards so the credentials don't linger.
</details>

## 5. Redeploy and verify

Vercel → **Deployments → ⋯ → Redeploy** (env var changes need a redeploy).

1. `https://<your-project>.vercel.app/up` → Laravel health page.
2. Open the site and log in with a seeded account.
3. API check:
   `POST /api/v1/auth/login` with `{"email","password","device_name"}` and
   `Accept: application/json` returns a bearer token; `GET /api/v1/me` with
   `Authorization: Bearer <token>` returns the user.

If you get a 500/502, check **Deployment → Logs (Runtime)**. Common causes:
missing `APP_KEY`, migrations not run (missing `sessions`/`cache` tables), or
no database variable connected to that environment.

## 6. Mobile app

API base URL: `https://<your-project>.vercel.app/api/v1` (see
[mobile-api-v1.md](./mobile-api-v1.md)). If **Deployment Protection** is on,
production URLs stay public on Hobby, but preview URLs require login — test the
mobile app against Production. Never embed a protection-bypass secret in the
app.

## Free-tier limitations

- **Uploaded files are not persistent.** Container storage is ephemeral
  (`/tmp`), so job-card photos/attachments on the `public` disk disappear when
  the instance recycles. For durable uploads, move the disk to S3-compatible
  storage (e.g. Supabase Storage or Cloudflare R2) via `league/flysystem-aws-s3-v3`.
- **Cold starts.** Idle instances scale down after ~5 minutes; the next
  request takes a few seconds.
- **No background workers.** `QUEUE_CONNECTION=sync` runs jobs inline. Use
  Vercel Cron for scheduled tasks if needed.
- **Neon free tier** suspends compute when idle (first query after a pause is
  slower). **Supabase free** projects pause after a week of inactivity.
- Container Runtime is **Beta** — check Vercel's usage page for Hobby limits.

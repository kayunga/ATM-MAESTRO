# Deploying ATM Maestro to Vercel + Neon (beginner guide)

This guide takes you from "code on my computer" to "working website on the
internet", using only free accounts. No prior deployment experience needed.

**What each service does**

| Service | Role | Cost |
| --- | --- | --- |
| **GitHub** | Stores your code. Vercel and the migration workflow read from it. | Free |
| **Vercel** | Runs the website (the Laravel app, inside a Docker container). | Free (Hobby plan) |
| **Neon** | Hosts the PostgreSQL database (users, ATMs, calls, job cards). | Free plan |

**How it fits together**

```
You push code ──► GitHub ──► Vercel builds + runs the app ──► Neon (database)
                     │
                     └──► GitHub Action creates the database tables in Neon
```

Time needed: about 30–45 minutes the first time.

> The Vercel and Neon websites change their layout from time to time. If a
> button is named slightly differently from this guide, look for the closest
> match. The ideas stay the same.

---

## Part 0 — Before you start

You need:

- A **GitHub account** with this repo already on it (`kayunga/ATM-MAESTRO`).
- **Git** installed on your computer (you already use it).
- **PHP** on your computer (Laravel Herd provides this). You only need it once,
  to generate a secret key.

Create free accounts (use "Continue with GitHub" for the easiest login):

1. Vercel: <https://vercel.com/signup>
2. Neon: <https://neon.tech> (you can also create Neon from inside Vercel in
   Part 3, which is the easiest way).

---

## Part 1 — Push the deployment files to GitHub

Vercel can only deploy what is on GitHub. Open a terminal (PowerShell) in the
project folder and run:

```powershell
git status
```

You should see changed files such as `Dockerfile`, `config/database.php`,
`.gitignore`, and new ones such as `docker/` and
`.github/workflows/migrate.yml`.

Check that no secret files are included. `.env` and `.env.local` must **not**
appear in the list. (They are ignored by `.gitignore`; only `.env.example`
should be tracked.)

Then commit and push:

```powershell
git add .
git commit -m "Configure Vercel + Neon deployment"
git push origin main
```

Open the repo on GitHub in your browser and confirm that `Dockerfile`,
`Caddyfile`, `vercel.json`, and the `docker` folder are there.

---

## Part 2 — Create the Vercel project

1. Go to <https://vercel.com/new> and sign in.
2. Under **Import Git Repository**, click **Adjust GitHub App Permissions** if
   your repo isn't listed, and allow access to `ATM-MAESTRO`.
3. Click **Import** next to `ATM-MAESTRO`.
4. On the configuration screen:
   - **Project Name:** anything you like. This becomes your web address:
     `https://<project-name>.vercel.app`.
   - **Framework Preset:** choose **Container**. If it isn't offered, choose
     **Other**. Do **not** pick Vite, because Laravel is the real app.
   - **Root Directory:** leave as `./`.
   - **Build / Output / Install commands:** leave everything empty. The
     Dockerfile does all the building.
5. **Do not click Deploy yet.** Open **Environment Variables** on this screen
   and add the two variables from Part 4 first. If you prefer, click **Deploy**
   now. It will fail or show an error page. That is expected, and you will
   redeploy after Parts 3–5.

**If Vercel picked the wrong framework** and you can't change it in the
dashboard, use the CLI from the project folder:

```powershell
npm install --global vercel
vercel login
vercel link
vercel project update --framework container --yes
```

---

## Part 3 — Set up Neon (the database)

You have two ways to do this. **Option A is recommended**: Vercel creates the
Neon database for you and shares the connection details with the project
automatically.

### Option A — Create Neon from inside Vercel (recommended)

1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database** (or **Browse Marketplace**) and choose **Neon**
   (Postgres).
3. Accept the terms and pick the **Free** plan.
4. Choose a **Region**. Pick the one closest to where your Vercel app runs.
   Vercel's default is usually US East, so choose a US East Neon region
   (e.g. *AWS US East (N. Virginia)*). Matching regions keeps the site fast.
   You cannot change the region later without recreating the database.
5. Give the database a name, e.g. `atm-maestro-db`, and click **Create**.
6. When asked to connect it to a project, choose your **ATM-MAESTRO** project.
   Settings to use in the dialog:
   - **Environments:** tick **Production** and **Preview**. Leave
     **Development** unticked.
   - **Custom Prefix:** leave it **empty**.
   - **Create database branch for deployment:** tick **Preview**; leave
     **Production** unticked. (This gives every preview deployment its own
     copy of the database, so tests can never damage real data.)
7. Click **Connect / Install**.

Vercel now adds these variables to your project (check **Settings →
Environment Variables**):

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | **Pooled** connection. The app uses this automatically. |
| `DATABASE_URL_UNPOOLED` | **Direct** connection. Used for migrations. |

You don't have to copy or edit `DATABASE_URL`. The app reads it by itself.

### Option B — Create Neon directly at neon.tech

Use this if you prefer to manage Neon separately.

1. Sign in at <https://console.neon.tech> and click **New Project**.
2. Enter a name (`atm-maestro`), pick the same region as above, keep the
   default Postgres version, and click **Create**.
3. On the project dashboard, click **Connect**. You will see a connection
   string like:

   ```text
   postgresql://username:password@ep-something-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. Turn the **Connection pooling** switch **on** and copy that string. This is
   your pooled URL. Turn pooling **off** and copy the string again. This is
   your direct (unpooled) URL.
5. In Vercel → **Settings → Environment Variables**, add `DB_URL` with the
   **pooled** string (scope: Production, and mark it **Sensitive**).

### Find your direct (unpooled) connection string

You need this in Part 5.

- **Option A:** Vercel → **Storage** → click your Neon database → **Open in
  Neon**. In Neon, click **Connect**, switch **Connection pooling** off, and
  copy the string.
- **Option B:** you already copied it in step 4.

Keep it somewhere private (a password manager). Treat it like a password.

---

## Part 4 — Add the app's secret key and URL

Laravel needs a secret key to encrypt sessions and cookies.

1. In PowerShell, in the project folder:

   ```powershell
   php artisan key:generate --show
   ```

   It prints something like `base64:AbC123...=`. Copy the whole line,
   including `base64:`.

   > Use a **new** key for production. Do not reuse the one from your local
   > `.env`, because an old copy was published in `.env.example` on GitHub.

2. In Vercel → your project → **Settings → Environment Variables**, add:

   | Name | Value | Environments |
   | --- | --- | --- |
   | `APP_KEY` | the `base64:...` key | Production (mark **Sensitive**) |
   | `APP_URL` | `https://<project-name>.vercel.app` | Production |

   Your exact address is shown on the project's **Overview** page after the
   first deploy (or under **Settings → Domains**).

3. Optional, for Preview deployments: add a **different** `APP_KEY` (generate
   another with the same command) scoped to **Preview** only.

Everything else (`APP_ENV=production`, `APP_DEBUG=false`, logging, sessions,
cache) is already set inside the Dockerfile. You don't need to add anything.

---

## Part 5 — Create the database tables (migrations)

A new Neon database is empty. The tables (users, ATMs, calls, ...) have to be
created. This repo includes a GitHub workflow that does it for you, so you
don't need anything installed locally.

### 5.1 Add secrets to GitHub

1. On GitHub, open your repo → **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add these three, one at a time:

   | Name | Value |
   | --- | --- |
   | `PRODUCTION_DATABASE_URL` | the **direct/unpooled** Neon string from Part 3 |
   | `SEED_ADMIN_PASSWORD` | the password for the admin account `admin@techmasters.zm` (12+ characters) |
   | `SEED_ENGINEER_PASSWORD` | the initial password for every engineer account (12+ characters, different from the admin one) |

   The passwords live only in GitHub Secrets, never in the code. Write them
   down; engineers use the second one for their first login.

### 5.2 Run the workflow

1. In GitHub, open the **Actions** tab.
2. In the left list, click **migrate database**. (If it isn't listed, make
   sure Part 1 pushed `.github/workflows/migrate.yml` to `main`. If GitHub
   asks you to enable workflows, click the green button.)
3. Click **Run workflow** (right side), keep branch `main`, **tick "Also seed
   admin, banks, engineers, ATMs and calls"**, and click the green **Run workflow** button.
4. Wait about a minute and refresh. A green check mark means success.
   Click the run to see logs. You should see lines like `Migrating:
   2024_01_01_000000_create_banks_table` followed by `DONE`.

The seed is the same one you run locally (`php artisan db:seed`): the admin
account, all banks, engineers and ATMs, the call history, and the Q4 PM
schedule.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@techmasters.zm` | your `SEED_ADMIN_PASSWORD` |
| Engineers | `<firstname>@techmasters.zm` (e.g. `philip@techmasters.zm`) | your `SEED_ENGINEER_PASSWORD` |

**Seed once only.** The seeder wipes banks, ATMs, engineers, calls and job
cards before loading them. It refuses to run when job cards already exist.
The workflow's **reset** checkbox overrides this and destroys live data, so
leave it unticked once the system is in use.

After the first seed, the workflow runs on its own whenever you push a new
migration file to `main`. You never need to tick "seed" again.

### 5.3 Check the data in Neon (optional)

In the Neon console, open **Tables**. You should see `users`, `atms`,
`calls`, `job_cards` and others.

<details>
<summary>Alternative: run migrations from your own computer</summary>

Needs PHP 8.3+ with the `pdo_pgsql` extension (Laravel Herd includes it).
In PowerShell from the project folder (these shell variables override your
local `.env` for this window only):

```powershell
$env:DB_CONNECTION = 'pgsql'
$env:DB_URL = '<direct/unpooled Neon connection string>'
php artisan migrate --force

# first time only:
$env:SEED_ADMIN_PASSWORD = '<strong password>'
$env:SEED_ENGINEER_PASSWORD = '<different strong password>'
php artisan db:seed --force
```

Close the terminal window afterwards so the credentials don't linger.
</details>

---

## Part 6 — Deploy and test

Environment variables only apply to **new** deployments, so redeploy now.

1. Vercel → your project → **Deployments**.
2. Click the **⋯** menu on the latest deployment → **Redeploy**.
3. Wait for the status to become **Ready**. The first Docker build takes
   several minutes. Later builds are faster.

Now test, replacing the address with yours:

1. **Health check:** open `https://<project-name>.vercel.app/up`. You should
   see a page saying the application is up.
2. **Website:** open `https://<project-name>.vercel.app` and log in with
   `admin@techmasters.zm` and your `SEED_ADMIN_PASSWORD`.
3. **API (for the mobile app).** In PowerShell:

   ```powershell
   $body = @{ email='philip@techmasters.zm'; password='<SEED_ENGINEER_PASSWORD>'; device_name='test' } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri https://<project-name>.vercel.app/api/v1/auth/login -Body $body -ContentType 'application/json' -Headers @{Accept='application/json'}
   ```

   A token in the response means the API and database both work.

**The first request after a quiet period is slow** (a few seconds). The free
container sleeps when idle, and so does Neon's free database. This is normal.

---

## Part 7 — Everyday workflow

- **Change code:** edit, `git commit`, `git push origin main`. Vercel
  rebuilds and deploys by itself.
- **Try a change safely:** push to another branch or open a pull request.
  Vercel gives it a separate Preview URL with its own Neon database branch.
  (The first time you use a Preview, run the migrate workflow against it, or
  expect empty tables.)
- **Change the database structure:** add a Laravel migration, push to `main`.
  The migrate workflow runs automatically, and Vercel deploys the code.
- **See errors:** Vercel → Deployments → click one → **Logs** (Runtime Logs).
- **Custom domain:** Vercel → **Settings → Domains**. Follow the DNS
  instructions, then update `APP_URL` and redeploy.

---

## Part 8 — Connecting the mobile app

Use this as the API base URL:

```text
https://<project-name>.vercel.app/api/v1
```

Endpoints are documented in [mobile-api-v1.md](./mobile-api-v1.md). On a
phone, `localhost` means the phone itself, so always use the full Vercel
address. If **Deployment Protection** is on, Preview URLs require a Vercel
login, but Production stays public on the free plan. Test the mobile app
against Production.

---

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Vercel build fails at `composer install` or `npm ci` | Open the build log. Usually a typo in a changed file. Re-run the build after fixing. |
| Page shows **500 Server Error** | Open Runtime Logs. Most often `APP_KEY` is missing (add it in Part 4, then redeploy). |
| Log says `No application encryption key` | `APP_KEY` is missing or not applied to this environment. Add it and redeploy. |
| Log says `relation "sessions" does not exist` or `"cache" does not exist` | Migrations haven't run. Do Part 5. |
| Log says `could not translate host name` / connection refused | No database URL on that environment. Check **Settings → Environment Variables** for `DATABASE_URL` (Neon) or `DB_URL`, scoped to Production. Then redeploy. |
| Log says `prepared statement ... does not exist` | The pooled connection doesn't like prepared statements. Add `DB_EMULATE_PREPARES=true` in Vercel, or set `DB_URL` to the **unpooled** string. Then redeploy. |
| Login works but you get logged out immediately | `APP_URL` wrong. It must be exactly your `https://...vercel.app` address. Fix and redeploy. |
| Migrate workflow fails with `Add the PRODUCTION_DATABASE_URL` | Secret missing or misspelled (Part 5.1). |
| Migrate workflow fails with `password authentication failed` | You pasted a wrong or old string. Copy a fresh one from Neon. |
| Uploaded photos vanish | Expected on the free setup. See limits below. |
| Site is slow on first visit | Cold start (container and database waking up). |

---

## Limits of the free setup

- **Uploaded files are not permanent.** Job-card photos and attachments are
  saved on the server's temporary disk, which is wiped whenever the container
  restarts. To keep uploads, switch the Laravel `public` disk to S3-compatible
  storage (Cloudflare R2, Supabase Storage, AWS S3). Ask for help doing this
  when you need it.
- **No background workers.** Queued jobs run immediately during the request
  (`QUEUE_CONNECTION=sync`).
- **Neon free plan** has storage and compute-hour limits and sleeps when idle.
  Check <https://neon.tech/pricing> for current numbers.
- **Vercel Container Runtime is in Beta.** Check your Vercel usage page for
  free-plan limits.
- This is good for tests and demos. For real production use with real bank
  data, plan an upgrade (paid database, persistent file storage, backups).

## Security checklist

- Never commit `.env` files, database URLs, or `APP_KEY`.
- Mark `APP_KEY` and database URLs as **Sensitive** in Vercel.
- Ask users to change their passwords after first login. Once seeding is
  done, you can delete `SEED_ADMIN_PASSWORD` and `SEED_ENGINEER_PASSWORD`
  from GitHub secrets.
- Keep Preview deployments on their own database branch, never the
  production one.

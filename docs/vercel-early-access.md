# Deploy ATM Maestro to Vercel for early access

This repository is configured for Vercel's **Container Runtime (Beta)** using
the Dockerfile and FrankenPHP. GitHub makes deployment easier: Vercel builds
the connected branch on each push and creates Preview Deployments for pull
requests.

Vercel Postgres is no longer a standalone product. For PostgreSQL, install a
Marketplace provider such as the Vercel-native Neon integration. See
[Postgres on Vercel](https://vercel.com/docs/postgres) and
[Deploy Laravel on Vercel with Docker](https://vercel.com/kb/guide/laravel-php-with-docker).

## 1. Push the deployment files to GitHub

The repo must contain the Vercel container setup before Vercel imports it:

- [Dockerfile](../Dockerfile)
- [Caddyfile](../Caddyfile)
- [vercel.json](../vercel.json)
- [.dockerignore](../.dockerignore)

Commit and push these files to the GitHub repository's `main` branch. The
repository is [kayunga/ATM-MAESTRO](https://github.com/kayunga/ATM-MAESTRO).
Do not commit `.env` files or database credentials.

The Dockerfile builds the Vite assets and the Laravel production dependencies.
It does not run migrations at startup; migrations must be run once as described
below. The container uses `stderr` logging, database sessions/cache, a
synchronous queue, and `/tmp` for Laravel's temporary storage.

## 2. Import the GitHub repository into Vercel

1. Sign in to [Vercel](https://vercel.com/) and choose **Add New → Project**.
2. Connect or authorize the GitHub account that can access the repository.
3. Find `kayunga/ATM-MAESTRO` and select **Import**.
4. Set the **Root Directory** to the repository root (`./`).
5. Use the **Container** framework/runtime preset. If Vercel detects a
   different framework, link the project with the CLI and select the Container
   preset:

   ```sh
   vercel.cmd link
   vercel.cmd project update --framework container --yes
   ```

6. Leave the build, install, and output-directory overrides empty; the
   Dockerfile builds the app. Keep `main` as the Production Branch.
7. Finish the import. The first deployment may not serve requests until the
   database and environment variables in steps 3–4 are ready; redeploy after
   configuring them. You do not need Docker installed locally for Vercel to
   build from GitHub; Docker is only needed for a local container test.

After linking, Vercel automatically builds subsequent pushes to GitHub. Pushes
to `main` update Production; pull requests and other branches get Preview
Deployments. See
[Deploying GitHub projects with Vercel](https://vercel.com/docs/git/vercel-for-github).

## 3. Provision PostgreSQL through Vercel

1. In the Vercel project, open **Storage / Marketplace** and install the
   **Neon Postgres** integration. Create a database and connect it to this
   project.
2. Use the provider's pooled connection string for the application. The
   integration may provide it as `DATABASE_URL`; Laravel in this repository
   reads `DB_URL`, so add `DB_URL` in **Project Settings → Environment
   Variables** with that same connection string.
3. Scope the production database credentials to **Production**. Use a
   separate Neon branch/database for Preview so test deployments cannot alter
   early-access production data.

The Neon connection string is a secret. Do not copy it into source code,
GitHub, or the mobile app.

## 4. Set the production environment variables

In **Project Settings → Environment Variables**, add these for **Production**:

```text
APP_ENV=production
APP_DEBUG=false
APP_KEY=<stable Laravel key>
APP_URL=https://<your-project>.vercel.app
DB_CONNECTION=pgsql
DB_URL=<pooled Neon PostgreSQL connection string>
DB_SSLMODE=require
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=sync
LOG_CHANNEL=stderr
```

Generate `APP_KEY` once from a trusted local checkout:

```sh
php artisan key:generate --show
```

Copy the printed key into Vercel as a sensitive environment variable. Keep the
same key for this environment across deployments. Never commit it. The
Dockerfile already supplies the other runtime defaults shown above; setting
them explicitly in Vercel makes the production configuration visible.

Add a different `APP_KEY` and a separate database connection for Preview if
you want to test Preview deployments. Do not point Preview at Production.

## 5. Run migrations and seed the early-access data

In PowerShell, install the Vercel CLI, sign in, and link your local checkout
to the imported Vercel project:

```sh
npm.cmd install --global vercel
vercel.cmd login
vercel.cmd link
```

Run these commands from the repository root on a machine with PHP 8.3+ and
the `pdo_pgsql` extension. They use the Production environment variables
without writing them to a local `.env` file:

```sh
vercel.cmd env run -e production -- php artisan migrate --force
vercel.cmd env run -e production -- php artisan db:seed --class=Pgsseeder --force
```

Before running the seed command, make the following two secrets available to
that command (for example, add them temporarily to the Vercel Production
environment):

```text
PGSSEED_ADMIN_PASSWORD=<unique strong password, at least 12 characters>
PGSSEED_ENGINEER_PASSWORD=<different unique strong password, at least 12 characters>
```

Remove those two seed-only variables from Vercel after seeding. The separate
seeder creates one admin, three engineer accounts, one sample bank, three
ATMs, and three calls. It is safe to run again and does not invoke or change
the existing seeders.

Sample login emails:

- Admin: `early-access-admin@example.com`
- Engineers: `lusaka.engineer@example.com`,
  `copperbelt.engineer@example.com`, and
  `southern.engineer@example.com`

Use the password configured for the corresponding account type, then change
these initial passwords after first access.

## 6. Deploy and verify

In Vercel, open **Deployments** and redeploy after adding or changing
environment variables. You can also push a commit to `main` to trigger a
Production deployment. Wait for the Container build to complete, then verify:

1. Open `https://<your-project>.vercel.app/up`; Laravel should return a
   successful health response.
2. Send a JSON login request to
   `https://<your-project>.vercel.app/api/v1/auth/login`. A successful login
   returns a Sanctum bearer token.
3. Call `GET /api/v1/me` with
   `Authorization: Bearer <token>` and `Accept: application/json`.
4. If the deployment returns 502, inspect its **Runtime Logs** and confirm the
   Container build completed and FrankenPHP is listening on Vercel's `PORT`.

The production hostname can be found under **Settings → Domains**.

## 7. Connect the mobile app

1. Set the mobile app's API base URL to:

   ```text
   https://<your-project>.vercel.app/api/v1
   ```

   Do not include `/api/v1` again in endpoint paths. On a physical phone,
   `localhost` refers to the phone, not this server.
2. For login, send `POST /auth/login` with JSON and `Accept:
   application/json`:

   ```json
   {
     "email": "lusaka.engineer@example.com",
     "password": "<the configured engineer password>",
     "device_name": "early-access-mobile"
   }
   ```

3. Save the returned token in the mobile platform's secure credential store.
   Send it on later requests as `Authorization: Bearer <token>`. For example,
   verify the connection with `GET /me`, then load
   `GET /engineer/atms` or `GET /engineer/calls`.
4. Native mobile HTTP clients do not need browser CORS configuration. If
   Vercel Deployment Protection is enabled, use a public/staging API
   deployment; never embed a Vercel protection-bypass secret in the app.
5. To use a custom domain, add it under **Settings → Domains**, complete the
   displayed DNS instructions, wait for TLS to become active, then update
   `APP_URL` and the mobile app's API base URL to
   `https://<your-custom-domain>/api/v1`.

See [mobile-api-v1.md](./mobile-api-v1.md) for all endpoints and request
formats.

## Early-access limitations to address

- Vercel containers have ephemeral storage. Laravel's temporary files use
  `/tmp`, and files written there disappear when an instance is recycled.
  This app currently stores job-card photos and attachments on its local
  `public` filesystem disk. Do not rely on uploaded files being durable until
  that disk is changed to persistent object storage.
- `QUEUE_CONNECTION=sync` runs queued work during the request. If the app
  later needs background jobs, configure a Vercel Daemon/queue integration
  rather than assuming a worker runs in the web container.
- The Vercel Container Runtime is currently Beta; check current Vercel plan
  limits and pricing before inviting external users.

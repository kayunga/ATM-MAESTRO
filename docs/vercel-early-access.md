# Early access deployment and mobile API

## Platform notes before deploying

Vercel Postgres is no longer offered as a standalone product. Vercel now
connects projects to PostgreSQL providers through the Marketplace; the Neon
integration offers a Vercel-native installation flow and provisions a Neon
Postgres database. See [Postgres on Vercel](https://vercel.com/docs/postgres)
and the [Neon Marketplace listing](https://vercel.com/marketplace/neon).

This repository is a Laravel/PHP application whose [Dockerfile](../Dockerfile)
starts a persistent PHP web server and runs migrations at container startup.
That is not a Vercel Functions entry point. Vercel's current
[backend documentation](https://vercel.com/docs/frameworks/backend) does not
document Laravel/PHP as a zero-configuration backend. A separate, compatible
PHP runtime/adapter and deployment validation would be needed before this app
can safely run on Vercel; no unverified `vercel.json` or runtime shim is
included here.

For a temporary early-access deployment with this repository as-is, use a
container host that runs the supplied Dockerfile. You can still provision
Postgres using the Neon Vercel Marketplace integration, or use Neon directly.
If you choose Vercel for the application anyway, first validate a PHP runtime
adapter against Laravel routing, session/auth, file uploads, and production
builds. Local filesystem uploads are ephemeral on serverless hosts; configure
persistent object storage before relying on signatures or attachments.

## Provision PostgreSQL and seed the early-access records

1. In Vercel, open **Integrations / Marketplace**, install the Neon Postgres
   integration, and connect it to the project. Create a database and copy its
   pooled connection string from the integration/provider dashboard.
2. Set the application's environment variables in its hosting environment:

   ```text
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=<a freshly generated Laravel key>
   APP_URL=https://<your-app-domain>
   DB_CONNECTION=pgsql
   DB_URL=<the Neon PostgreSQL connection string>
   DB_SSLMODE=require
   PGSSEED_ADMIN_PASSWORD=<unique strong password, at least 12 characters>
   PGSSEED_ENGINEER_PASSWORD=<different unique strong password, at least 12 characters>
   ```

   Do not commit credentials or paste them into mobile-app source. Use the
   host's encrypted environment-variable settings. Generate an application
   key with `php artisan key:generate --show` in a trusted local environment.
3. Ensure the PostgreSQL driver (`pdo_pgsql`) is present in the PHP runtime.
   The provided Dockerfile installs it, but a Vercel PHP adapter must provide
   the equivalent extension.
4. Against the new, empty database, run the migrations and only the separate
   early-access seeder:

   ```sh
   php artisan migrate --force
   php artisan db:seed --class=Pgsseeder --force
   ```

   The seeder is additive/idempotent and creates a sample bank, admin, three
   engineer accounts, three ATMs, and three calls. It does not call or change
   the existing seeders. Do not run `DatabaseSeeder` or `TechmastersSeeder`
   for this setup; `TechmastersSeeder` truncates fleet data.
5. Test the deployment's health endpoint at `https://<your-app-domain>/up`.
   Also confirm `POST https://<your-app-domain>/api/v1/auth/login` responds
   with JSON before configuring the mobile client.

Run the seed command from a trusted deployment shell/CI job with the two
`PGSSEED_*_PASSWORD` variables available to Laravel. Do not put these seed
passwords in a committed `.env` file. The sample login emails are
`early-access-admin@example.com`, `lusaka.engineer@example.com`,
`copperbelt.engineer@example.com`, and `southern.engineer@example.com`; set
their passwords using the environment variables above and change them after
initial access. If you change environment variables after configuration has
been cached, rebuild the deployment/config cache before seeding.

## Point a mobile client at the deployed API

1. Use the deployed HTTPS origin and include the API prefix:

   ```text
   https://<your-app-domain>/api/v1
   ```

   For a Vercel project this may be `https://<project-name>.vercel.app/api/v1`.
   A custom domain works the same way after its DNS and TLS certificate are
   active.
2. Store that base URL in the mobile app's environment/build configuration,
   not in each request. Do not use `localhost` on a physical phone; it refers
   to the phone itself.
3. Log in with `POST /auth/login`, JSON content type, and `Accept:
   application/json`:

   ```json
   {
     "email": "lusaka.engineer@example.com",
     "password": "<the configured engineer password>",
     "device_name": "early-access-mobile"
   }
   ```

   Save the returned bearer token in the platform's secure credential store.
   Send subsequent requests with `Authorization: Bearer <token>` and
   `Accept: application/json`. Use `POST /auth/logout` to revoke the current
   device token.
4. Confirm the connection with an authenticated `GET /me`, followed by
   `GET /engineer/atms` or `GET /engineer/calls`. The complete endpoint list
   and payload behavior are in [mobile-api-v1.md](./mobile-api-v1.md).
5. Native mobile HTTP clients do not need browser CORS configuration. If the
   deployment has Vercel Deployment Protection enabled, make the API
   deployment accessible to the app through an appropriate public/staging
   environment; never embed a Vercel protection-bypass secret in the mobile
   app. The API itself should remain protected by Sanctum bearer tokens.

The base URL can later be switched from the `vercel.app` hostname to a custom
domain without changing endpoint paths or token handling.

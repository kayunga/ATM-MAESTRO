# Mobile Engineer API v1

Base URL: `/api/v1`. All responses are JSON. Send `Accept: application/json`;
authenticated requests use `Authorization: Bearer <token>`.

## Authentication

- `POST /auth/login` — JSON body: `email`, `password`, and optional `device_name`.
  The response contains a bearer `token`, `token_type`, and engineer profile.
- `GET /me` — current engineer profile, signature, admin flag, and assigned ATM count.
- `PUT /me/signature` — JSON body with a PNG or JPEG data URL in `signature`;
  send `null` to remove it.
- `PUT /me/password` — JSON body with `current_password`, `password`, and
  `password_confirmation`; current password is verified before update.
- `POST /auth/logout` — revokes the current bearer token only. Other signed-in
  devices remain active.

Use the token returned by login as a bearer token. Login tokens are named per
device and are not invalidated when another device signs in.

## Engineer operations

- `GET /engineer/atms` — assigned ATMs; accepts `search`, `status`, `page`, and
  `per_page`.
- `GET /maintenance` — assigned PM schedule/history; accepts `atm_id`, `status`,
  `type`, `quarter`, `year`, `page`, and `per_page`.
- `GET /engineer/job-cards` — own cards; accepts `status`, `job_type`, `page`,
  and `per_page`.
- `POST /engineer/job-cards` — create a PM or repair card. Supports JSON or
  `multipart/form-data`; multipart requests may include repeated `files[]`
  attachments. `submit_now` submits immediately; otherwise the card is saved
  as a draft. Technician signatures are taken from the signed-in engineer's
  profile, not from client-supplied values.
- `GET /engineer/job-cards/{id}` — retrieve one of the engineer's cards.
- `PUT|PATCH /engineer/job-cards/{id}` — update an owned draft only;
  multipart updates can append `files[]` attachments.
- `DELETE /engineer/job-cards/{id}` — delete an owned draft only.
- `POST /engineer/job-cards/{id}/photos` — upload up to five image photos.
- `POST /engineer/job-cards/{id}/submit` — submit an owned draft for review.
- `GET /engineer/job-cards/{id}/print` — retrieve the branded print-ready job
  card HTML for the assigned engineer; authenticate with the mobile bearer token.
- `GET /engineer/calls` — open calls. Accepts `scope=all|mine`, `status`,
  `priority`, `search`, `page`, and `per_page`. `scope=all` includes open calls
  available for self-assignment.
- `POST /engineer/calls/{id}/assign` — self-assign an unassigned call.
- `POST /engineer/calls/{id}/return` — return an assigned call to the pool.
- `POST /engineer/calls/{id}/note` — save a call note.
- `POST /engineer/calls/{id}/close` — close a call and create its repair card;
  supports `multipart/form-data` and repeated `files[]` attachments.

List endpoints return Laravel's paginator JSON with `data`, `current_page`,
`last_page`, `per_page`, `total`, and page URL fields. `per_page` defaults to 25
and is limited to 100. Validation failures return HTTP 422 with an `errors`
object; unauthenticated and unauthorized requests return HTTP 401 and 403
respectively.

## Compatibility and administration

The original unversioned engineer paths remain available for compatibility.
Their list responses remain unpaginated arrays. New mobile clients should use
`/api/v1`.

The legacy `/api/stats`, `/api/atms`, and `/api/engineers` endpoints require an
authenticated administrator. They are not part of the engineer mobile API.

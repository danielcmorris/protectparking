# Vallejo Street API (stub)

Minimal Express API for the *Stop the Vallejo Street Takeover* site. It accepts
comment/contact submissions and exposes the running tally for the pledge counter.

> **Status: STUB.** The Postgres layer in `src/db.js` is sketched but not wired
> up (`ENABLE_DB = false`) — endpoints respond with canned/in-memory values so
> the server runs with no database present. Finish the `TODO`s in `src/db.js`
> and flip `ENABLE_DB` once a Postgres instance + schema exist.

## Endpoints
| Method | Path                  | Purpose                                  |
|--------|-----------------------|------------------------------------------|
| GET    | `/health`             | Liveness/readiness probe for Cloud Run   |
| POST   | `/api/comments`       | Save a submission `{name,address,email,district3,comment}` (email required) |
| GET    | `/api/comments/count` | Running tally for the "neighbors have spoken up" counter |
| GET    | `/api/comments`       | **Admin only** — list submissions (PII). Requires the `x-admin-token` header (or `?token=`) to match `ADMIN_TOKEN`. Returns 503 if `ADMIN_TOKEN` is unset. Supports `?limit=` (≤500) and `?offset=`. |

## Admin comment viewer
`/admin.html` is a token-gated page that lists submissions in a table with a CSV
export. It calls `GET /api/comments` with the token you enter (held in
`sessionStorage`, never persisted). Set `ADMIN_TOKEN` in the environment to
enable it — in prod it's injected from the `protectparking-admin-token` secret
(see `deploy/service.yaml`).

## Run locally
```bash
npm install
DATABASE_URL=... npm start          # plain node
# or, with a throwaway Postgres:
docker compose up --build
```

## Database
Schema lives in `db/schema.sql`. Apply it once Postgres is up:
```bash
psql "$DATABASE_URL" -f db/schema.sql
```
The connection string is read from `DATABASE_URL` (kept in `../creds` locally,
Secret Manager in prod) — never committed.

## Containerize & deploy (Cloud Run)
```bash
# build + push + deploy in one shot
gcloud builds submit --config deploy/cloudbuild.yaml \
  --substitutions=_REGION=us-west1,_REPO=vallejo

# or apply the service spec directly
gcloud run services replace deploy/service.yaml --region us-west1
```
Region is `us-west1` to match the project default. The container runs as a
non-root user and honors Cloud Run's injected `PORT` and `SIGTERM`.

> This service makes **no** calls to Google data/AI APIs at runtime; its only
> external dependency is Postgres. Cloud Build/Run are deployment infrastructure
> only.

# SHOPEN store
Storefront `/`, admin `/admin`, serverless API `api/index.js`. No build step.

Vercel → Settings → Environment Variables: `ADMIN_PASSWORD`, `JWT_SECRET`, then Storage → Upstash Redis (connect), then Redeploy.
Without Redis, data resets (temporary memory only).

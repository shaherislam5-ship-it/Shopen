# SHOPEN – E-commerce store

Storefront (`/`), admin panel (`/admin`), and a serverless API (`api/index.js`) — no build step, no dependencies.

## Deploy
1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo, click **Deploy**.
3. **Project → Settings → Environment Variables**, add:
   - `ADMIN_PASSWORD` – your admin password (default is `admin123`, change it!)
   - `JWT_SECRET` – any long random string
4. **Project → Storage**: create an **Upstash Redis** (Marketplace) database and connect it to the project.
   Vercel adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically. Redeploy.

Without step 4 the site still runs, but data lives in temporary memory and resets. Use Redis for real orders and products.

## Admin (`yoursite.com/admin`)
Dashboard stats, add/edit/delete products (with photo upload), manage order status, edit store name, currency, delivery fees, contact info and banner.

## Local test
`npx vercel dev`

# WAGA BITS

WAGA BITS is a food-business management platform for recording food sales and expenses, organizing food types, tracking stock, and managing staff.

## Run locally

Requirements: Node.js 20+ and MongoDB.

1. Install from the repository root: `npm install`
2. For a fresh setup, copy `backend/.env.example` to `backend/.env`, set a strong `JWT_SECRET`, configure MongoDB, and set the owner email and password.
3. Initialize the single WAGA BITS business and its owner account:

   ```sh
   npm run seed:business-owner
   ```

4. Optionally create the WAGA BITS support developer account:

   ```sh
   npm run seed:developer
   ```

5. Start the API and management dashboards:

   ```sh
   npm run dev:backend
   npm run dev:frontend
   ```

   - Owner, chef, and developer dashboard: `http://localhost:5173`
   - Business information page: `http://localhost:5174/`

The backend must be running for the management dashboard to load or submit data. For a different backend address, set `VITE_API_URL` in `frontend/admin/.env` (copy `.env.example`); use the backend origin without a trailing slash. The business information page at port 5174 links to the management dashboard. Set `VITE_ADMIN_URL` in `frontend/customer/.env` if the dashboard is hosted at a different URL (copy `.env.example`).

For local bootstrap, business details and the initial owner email/password are configured in `backend/.env`; `npm run seed:business-owner` initializes the single business and owner account. In a hosted deployment, the developer can instead create the first business owner from the dashboard, which sets up the business automatically. The developer supports the business and its staff. Owners and authorized chefs can add food types and stock items, record food sales, record and approve expenses, and review reports for daily, monthly, yearly, or custom date ranges. Sales and expense reports are based on manually recorded business records.

The dashboard also supports chef accounts, stock adjustments, account access support, and password resets.

## Project layout

```text
frontend/
  admin/       Shared owner, chef and developer portal (React + Tailwind)
  customer/    Business information page (React + Tailwind)
backend/
  src/
    middleware/
    models/
    routes/
    utils/
```

Food photos are uploaded to `backend/uploads/` (JPG, PNG or WebP, up to 5 MB). Passwords use bcrypt, sessions use HttpOnly JWT cookies that renew for six hours after each authenticated API request, and role and business access checks protect management APIs. Customer menu, table, and ordering APIs are not enabled. The developer support dashboard can view the current password of any business owner or chef account for 15 seconds, and the business owner can do the same for their chef accounts; viewable passwords are AES-256-GCM encrypted using `PASSWORD_VAULT_KEY` (falling back to `JWT_SECRET`), and accounts created before that feature need one password reset to become viewable.

### Deploying on Render and Vercel

For the Render backend, set `MONGODB_URI`, a `JWT_SECRET` of at least 32 characters, `COOKIE_SECURE=true`, and `CLIENT_URLS` to the exact HTTPS origin of the Vercel dashboard (for example, `https://your-dashboard.vercel.app`, with no trailing slash). Production uses secure, HttpOnly session cookies. Authenticated activity renews the six-hour session; it expires after six hours without an authenticated API request.

The developer can initialize the production business directly in the dashboard: open **Accounts** and create a **Business owner** account. The backend creates or reactivates the fixed WAGE BITES business together with the owner account; no business-name entry, database seed command, or manual database edits are required. Once created, the owner can add their own chefs, and the developer can also create chef accounts when requested. `npm run seed:business-owner` remains available for local setup or automated provisioning.

For the Vercel admin frontend (with the Vercel project root set to `frontend/admin`), add `BACKEND_URL` as a server-side environment variable set to the Render backend origin (for example, `https://your-api.onrender.com`, with no trailing slash). Production API requests go through the Vercel proxy so the browser stores the HttpOnly session cookie on the dashboard's own domain. The Vercel project includes proxy routes and nested catch-alls for the `auth`, `owner`, `developer`, `stock`, and `notifications` API paths, so deeper subsection requests also reach the backend. Keep `VITE_API_URL` set to the Render origin if you use live socket updates or backend-hosted images; it is a public URL, not a secret, and production API requests do not send login cookies directly to it. If you use a custom domain, allow that exact dashboard origin in Render's `CLIENT_URLS` as well. Keep `JWT_SECRET` and other backend secrets only in Render's environment settings.

The checked-in `.env.example` files contain local-development values; keep real credentials in ignored `.env` files or deployment environment settings.

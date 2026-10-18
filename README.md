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

Every new stock addition, sale, expense, and damage record waits for explicit approval regardless of who created it. These records remain editable until approved.

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

### Deploying on Render and Netlify

For the Render backend, set `MONGODB_URI`, a `JWT_SECRET` of at least 32 characters, `COOKIE_SECURE=true`, and `CLIENT_URLS` to the exact HTTPS origin of the dashboard (for example, `https://your-dashboard.netlify.app`, with no trailing slash). Production uses secure, HttpOnly session cookies. Authenticated activity renews the six-hour session; it expires after six hours without an authenticated API request.

The developer can initialize the production business directly in the dashboard: open **Accounts** and create a **Business owner** account. The backend creates or reactivates the fixed WAGE BITES business together with the owner account; no business-name entry, database seed command, or manual database edits are required. Once created, the owner can add their own chefs, and the developer can also create chef accounts when requested. `npm run seed:business-owner` remains available for local setup or automated provisioning.

For the Netlify admin frontend, the root `netlify.toml` builds from the repository root (`npm run build:admin`, publishing `frontend/admin/dist`). The generated `_redirects` file sends `/api/*` and `/uploads/*` through the `backend-proxy` function before the SPA fallback. Set Netlify's `BACKEND_URL` environment variable to the Render service origin (for example, `https://your-service.onrender.com`, with no path or trailing slash), and set `VITE_API_URL` to that same public origin for live socket updates. Production API calls and uploads stay same-origin and are proxied server-side, so the browser stores the HttpOnly session cookie on the dashboard's domain. `CLIENT_URLS` on Render must include the exact dashboard origin for socket connections. Keep `JWT_SECRET` and other backend secrets only in Render's environment settings. If Netlify is configured with `frontend/admin` as its Base directory, its `netlify.toml` points function discovery at the same proxy function; the `_redirects` file is copied into the published site in either configuration.

The checked-in `.env.example` files contain local-development values; keep real credentials in ignored `.env` files or deployment environment settings.

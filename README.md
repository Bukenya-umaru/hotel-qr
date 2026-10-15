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

Business details and the initial owner email/password are configured in `backend/.env`; `npm run seed:business-owner` initializes the single business and owner account. The developer supports the business and its staff. Owners and authorized chefs can add food types and stock items, record food sales, record and approve expenses, and review reports for daily, monthly, yearly, or custom date ranges. Sales and expense reports are based on manually recorded business records.

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

Food photos are uploaded to `backend/uploads/` (JPG, PNG or WebP, up to 5 MB). Passwords use bcrypt, sessions use HttpOnly JWT cookies, and role and business access checks protect management APIs. Customer menu, table, and ordering APIs are not enabled. The developer support dashboard can view the current password of any business owner or chef account for 15 seconds, and the business owner can do the same for their chef accounts; viewable passwords are AES-256-GCM encrypted using `PASSWORD_VAULT_KEY` (falling back to `JWT_SECRET`), and accounts created before that feature need one password reset to become viewable.

### Deploying on Render and Vercel

For the Render backend, set `MONGODB_URI`, a `JWT_SECRET` of at least 32 characters, `COOKIE_SECURE=true`, and `CLIENT_URLS` to the exact HTTPS origin of the Vercel dashboard (for example, `https://your-dashboard.vercel.app`, with no trailing slash). The secure cookie uses `SameSite=None` so sign-in sessions can be sent from the Vercel site to the separate Render API.

For the Vercel admin frontend, set `VITE_API_URL` to the Render backend origin (for example, `https://your-api.onrender.com`, with no trailing slash), then redeploy so the value is included in the frontend build. If you use a custom domain, allow that exact dashboard origin in `CLIENT_URLS` as well. Keep the backend secrets in Render's environment settings; never put them in Vercel's frontend environment.

The checked-in `.env.example` files contain local-development values; keep real credentials in ignored `.env` files or deployment environment settings.

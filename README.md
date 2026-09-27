# WAGA BITS

WAGA BITS is a single-business ordering platform, with a customer menu and separate owner, order-admin, and developer support dashboards.

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

5. Start the API and both websites:

   ```sh
   npm run dev:backend
   npm run dev:frontend
   ```

   - Staff/developer dashboard and shared sign-in form: `http://localhost:5173`
   - Customer menu: `http://localhost:5174/`

The backend must be running for either website to load or submit data. For a different backend address, set `VITE_API_URL` in both `frontend/admin/.env` and `frontend/customer/.env` (copy each `.env.example`); use the backend origin without a trailing slash. Restart the frontend dev servers after changing it. For production builds, configure the same variable to the deployed backend origin so API requests and live order updates reach the backend instead of returning the frontend HTML page.

Business details and the initial owner email/password are configured in `backend/.env`; `npm run seed:business-owner` initializes the single business and owner account. The developer does not create the business. The owner creates chef accounts. Chefs create dining tables and seat capacities, then create and manage customer-facing menu items, add food categories as they add dishes, set prices in Ugandan shillings (UGX), upload food photos, control item availability, and receive incoming orders. Customers opening the customer website land directly on the business menu, select a table and party size, and place an order. Orders reserve the party’s seats, so a table at capacity is unavailable to new groups. When guests leave, the chef clears the table to set its occupied seats to zero. Menu and table availability changes are published to the customer website immediately.

Owners can review daily results and use the reports dashboard to view sales and profit for daily, monthly, yearly, or custom date ranges. The developer support dashboard monitors the business and helps the team with account access and password resets.

## Project layout

```text
frontend/
  admin/       Shared owner, chef and developer portal (React + Tailwind)
  customer/    Separate customer ordering website (React + Tailwind)
backend/
  src/
    middleware/
    models/
    routes/
    utils/
```

Menu photos are uploaded to `backend/uploads/` (JPG, PNG or WebP, up to 5 MB). Passwords use bcrypt, sessions use HttpOnly JWT cookies, role and business access checks protect APIs, and customer menu/order responses exclude internal cost data.

Set `COOKIE_SECURE=true` and configure `CLIENT_URLS` for the HTTPS origins of both websites before deployment. The checked-in `.env.example` contains placeholders; keep real credentials in the ignored `backend/.env` file.

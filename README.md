# Atelier API

Express + MongoDB backend for the Atelier storefront and admin panel. Integrates
Cloudinary (images), Razorpay (payments) and Shiprocket (shipping).

## Setup

```bash
npm install
cp .env.example .env   # fill in Mongo URI + Cloudinary/Razorpay/Shiprocket keys
npm run seed            # creates categories, products, promo codes, and an admin user
npm run dev              # http://localhost:5050
```

Local MongoDB: `brew install mongodb-community && brew services start mongodb-community`,
or point `MONGODB_URI` at an Atlas cluster.

Seeded admin login: whatever `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are set to
in `.env` (defaults: `admin@atelier.com` / `Admin@12345`).

## What's wired for real vs. what needs your keys

Everything below was run end-to-end against a local MongoDB: auth (customer +
admin, role-based authorization), category/product CRUD, checkout → stock
decrement → invoice generation, promo codes, order status transitions (cancel →
restock/refund, COD delivered → paid), flash sales, support tickets, updates,
users, and the dashboard aggregates.

**Cloudinary, Razorpay and Shiprocket calls are fully implemented against their
real APIs but untested live** — I don't have your account credentials. Once you
drop real keys into `.env`:
- Cloudinary: product/category/banner image uploads (`multipart/form-data`)
  start working immediately, no code changes needed.
- Razorpay: `POST /api/orders/checkout` with `paymentMethod: "Razorpay"` returns
  a real order to open in Razorpay Checkout; `POST /api/payments/verify`
  confirms it. Point a webhook at `/api/payments/webhook` as a server-side
  safety net.
- Shiprocket: shipments are pushed automatically after payment (or immediately
  for COD); admins can also trigger `/api/orders/:id/ship` manually or check
  `/api/orders/:id/track`.

## Auth

JWT in an httpOnly cookie **and** returned in the response body (so the admin
SPA and storefront SPA can both use it). Roles: `customer`, `staff`, `admin`.

| Route | Method | Access |
|---|---|---|
| `/api/auth/register` | POST | public |
| `/api/auth/login` | POST | public |
| `/api/auth/admin-login` | POST | public (requires staff/admin role) |
| `/api/auth/logout` | POST | public |
| `/api/auth/me` | GET | authenticated |

## Resource routes

All admin-only routes require `authorize('admin', 'staff')` (delete endpoints
are `admin`-only). Full list mirrors every admin panel page:

- `/api/products` — public listing/filtering + admin CRUD, `/featured`,
  `/new-arrivals`, `/best-sellers`, `/search`, `/:slug`, `/:slug/related`
- `/api/categories` — public list + admin CRUD (blocks delete while products
  reference it)
- `/api/orders` — `/checkout` (guest-friendly), `/mine`, admin list/get,
  `/:id/status`, `/:id/ship`, `/:id/track`
- `/api/invoices` — admin list/get/`:id/pdf` (generated with `pdfkit`)
- `/api/banners` — public (Live only) + admin CRUD with image upload
- `/api/promo-codes` — admin CRUD + public `/validate`
- `/api/flash-sales` — admin CRUD + public `/active`
- `/api/support` — public create (guest or logged-in), `/mine`, admin list,
  `/:id/messages`, admin `/:id` status update
- `/api/updates` — public list + admin create/delete
- `/api/users` — admin list/get/update/delete, self `/me` + `/me/addresses`
- `/api/dashboard` — admin-only aggregate stats (revenue trend, order status
  breakdown, recent orders, best sellers)
- `/api/shipping/serviceability` — public pincode check

## Notes for the frontend/admin wiring pass

- Checkout takes `{ items: [{productId, size, color, quantity}], shippingAddress, promoCode?, paymentMethod, email? }` and recomputes all totals server-side — never trust client-sent prices.
- CORS is locked to `CLIENT_URL` and `ADMIN_URL` with credentials enabled, so both Vite apps can call this API with cookies.

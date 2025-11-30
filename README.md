# Tennan Milkshake Ordering Website

A full-stack web application for ordering milkshakes, managing users, and generating audit and sales reports. Built with Node.js, Express, MySQL, and a modern HTML/CSS/JavaScript frontend.

## Project Structure

```
tennan_website/
├── index.html                # Main landing page
├── package.json              # Node.js dependencies
├── server.js                 # Express backend server
├── seed-users.js             # User seeding script
├── elements/                 # Custom HTML elements
├── javascript/               # Frontend JS files
│   ├── lookup.js
│   ├── order-submission.js
│   ├── script.js
│   └── signin-signup.js
├── pages/                    # HTML pages
│   ├── home.html
│   ├── lookup.html
├── styles/                   # CSS files
│   ├── lookup.css
│   ├── signin-signup.css
│   └── styles.css
└── README.md                 # This file
```

## Features

- **User Registration & Login**: Secure authentication with password hashing
- **Role-Based Access**: Manager and client roles with permission checks
- **Order System**: Place orders for milkshakes with custom options
- **Audit Logging**: All changes tracked with user, timestamp, old/new values
- **Reporting**: View recent orders, sales per week/month, top categories, and summary stats
- **Category Management**: Add, edit, delete flavours, toppings, thicknesses (manager only)
- **Responsive Frontend**: Modern UI, mobile-friendly, clear notifications
- **Confirmation Dialogs**: Prevent accidental destructive actions
- **Edge Case Handling**: Robust validation and error messages

## Setup & Installation

### Prerequisites
- Node.js (v16+ recommended)
- MySQL server
- VS Code or any text editor

## How to Access the Web App

1. Open a terminal and navigate to the project root folder:

2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   node server.js
   ```
4. Open your web browser and go to:
   ```
   http://localhost:3000
   ```

This will load the home page of the Milky Shaky Drinks web app. You can use all features from your browser while the server is running.


## Email Confirmation (Formspree)
- After payment, a confirmation email is sent to the user using Formspree.
- To enable this, create a free Formspree account and form at https://formspree.io/.
- Replace `{form_id}` in `server.js` with your Formspree form ID.
- The backend sends a POST request to Formspree to deliver the email receipt.

## Notes
- You do not need to configure SMTP or Nodemailer.
- All email sending is handled via Formspree’s API.
- For more details, see https://formspree.io/docs/

## API Endpoints (Summary)

### User & Auth
- `POST /api/register` — Register new user
- `POST /api/login` — Login user
- `GET /api/users/check-email` — Check email availability
- `GET /api/users/:userId` — Get user info
- `GET /api/users` — List all users

### Orders
- `POST /api/orders` — Place new order (authenticated)
- `GET /api/orders` — List all orders
- `GET /api/users/:userId/orders` — Get orders for a user
- `POST /api/users/:userId/recalc-order-amount` — Recalculate user’s order count

### Categories
- `GET /api/flavours|toppings|thicknesses` — List categories
- `POST /api/flavours|toppings|thicknesses` — Add category (manager only)
- `PUT /api/flavours|toppings|thicknesses/:id` — Update category (manager only)
- `DELETE /api/flavours|toppings|thicknesses/:id` — Delete category (manager only)

### Auditing & Reports
- `GET /api/audit-log/all` — All audit log records
- `GET /api/audit/recent` — Recent audit records (manager only)
- `GET /api/reports/recent-orders` — Last 20 orders with details (manager only)
- `GET /api/reports/orders-per-week|orders-per-month` — Orders grouped by week/month
- `GET /api/reports/top-categories` — Top flavours/toppings/thicknesses
- `GET /api/reports/summary` — Summary stats (orders, revenue, top categories)

## Authentication & Roles
- All endpoints requiring authentication expect `x-user-id` header
- Manager-only endpoints require user role to be `manager`

## Auditing & Reporting
- All changes to users, orders, and categories are logged in the `audit_log` table
- Audit records include user, action, table, field, old/new value, and timestamp
- Reporting endpoints provide sales, trends, and top categories

## Edge Case Testing
- The app validates all inputs and handles errors gracefully
- Try submitting invalid, missing, or duplicate data to test robustness
- Permission errors and authentication are handled with clear messages





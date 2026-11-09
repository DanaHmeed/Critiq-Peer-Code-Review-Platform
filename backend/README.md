# Critiq — Backend API

Express + PostgreSQL REST API for the Critiq peer code review platform.

## Stack
- **Runtime**: Node.js + Express 4
- **Database**: PostgreSQL (via `pg` pool)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Validation**: express-validator
- **Security**: helmet, cors, express-rate-limit

---

## Project Structure

```
backend/
├── server.js                  # Entry point — starts HTTP server
├── .env                       # Environment variables (git-ignored)
├── .env.example               # Template for new developers
├── package.json
└── src/
    ├── app.js                 # Express app, middleware, route mounting
    ├── config/
    │   ├── db.js              # PostgreSQL pool + testConnection()
    │   └── initDb.js          # One-time schema creation script
    ├── middleware/
    │   ├── auth.js            # protect() + restrictTo() JWT guards
    │   ├── errorHandler.js    # Global error handler + asyncHandler()
    │   └── validate.js        # express-validator result checker
    ├── models/                # SQL query abstractions
    │   ├── user.model.js
    │   ├── request.model.js
    │   ├── comment.model.js
    │   └── notif.model.js
    ├── routes/
    │   ├── auth.routes.js     # POST /register, POST /login, GET /me
    │   ├── request.routes.js  # CRUD for review requests
    │   ├── comment.routes.js  # Inline line comments
    │   ├── user.routes.js     # Profiles + reviewer list
    │   ├── notif.routes.js    # Notifications
    │   └── admin.routes.js    # Admin-only endpoints
    └── controllers/
        ├── auth.controller.js
        ├── request.controller.js
        ├── comment.controller.js
        ├── user.controller.js
        ├── notif.controller.js
        └── admin.controller.js
```

---

## Quick Start

For the authentication audit, exact GitHub/email settings, migration notes, and verification limits, see [AUTH-AUDIT.md](../AUTH-AUDIT.md).

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in DB_PASSWORD and JWT_SECRET in .env
```

Generate the signing secret directly into `.env` without printing it:
```bash
npm run auth:secret
```

### 3. Create the database
```bash
# In psql:
CREATE DATABASE critiq_db;
```

### 4. Run the schema migration
```bash
npm run db:init
```

### 5. Start the dev server
```bash
npm run dev     # nodemon — auto-restarts on changes
npm start       # production
```

---

## API Reference

### Auth — `/api/auth`
| Method | Path        | Body                          | Auth | Description       |
|--------|-------------|-------------------------------|------|-------------------|
| POST   | /register   | name, email, password, role   | ✗    | Create account    |
| POST   | /login      | email, password               | ✗    | Get JWT token     |
| GET    | /me         | —                             | ✓    | Current user info |

### Review Requests — `/api/requests`
| Method | Path               | Auth | Description                    |
|--------|--------------------|------|--------------------------------|
| GET    | /                  | ✓    | All open requests (reviewers)  |
| GET    | /mine              | ✓    | My submitted requests          |
| GET    | /:id               | ✓    | Single request + comments      |
| POST   | /                  | ✓    | Submit new request             |
| PATCH  | /:id/status        | ✓    | Update status                  |
| PATCH  | /:id/assign        | ✓    | Assign reviewer                |
| DELETE | /:id               | ✓    | Delete (author or admin)       |

### Comments — `/api/comments`
| Method | Path    | Auth | Description                    |
|--------|---------|------|--------------------------------|
| POST   | /       | ✓    | Add inline comment to a line   |
| GET    | /       | ✓    | Get comments (?request_id=...) |
| DELETE | /:id    | ✓    | Delete (author or admin)       |

### Users — `/api/users`
| Method | Path        | Auth | Description          |
|--------|-------------|------|----------------------|
| GET    | /reviewers  | ✓    | List all reviewers   |
| GET    | /:id        | ✓    | Public profile       |
| PATCH  | /me         | ✓    | Update own profile   |

### Notifications — `/api/notifs`
| Method | Path         | Auth | Description             |
|--------|--------------|------|-------------------------|
| GET    | /            | ✓    | My notifications        |
| PATCH  | /:id/read    | ✓    | Mark one as read        |
| PATCH  | /read-all    | ✓    | Mark all as read        |

### Admin — `/api/admin` *(admin role only)*
| Method | Path                  | Description              |
|--------|-----------------------|--------------------------|
| GET    | /stats                | Platform overview stats  |
| GET    | /users                | All users (paginated)    |
| PATCH  | /users/:id/role       | Change user role         |
| PATCH  | /users/:id/suspend    | Suspend / unsuspend      |
| GET    | /requests             | All requests (paginated) |

---

## Auth Flow

```
POST /api/auth/login  →  { token, user }
                              ↓
          Store token in localStorage / memory
                              ↓
  All protected requests:  Authorization: Bearer <token>
```

---

## Environment Variables

| Variable       | Description                       | Example                  |
|----------------|-----------------------------------|--------------------------|
| PORT           | Server port                       | 5000                     |
| NODE_ENV       | Environment                       | development              |
| DB_HOST        | PostgreSQL host                   | localhost                |
| DB_PORT        | PostgreSQL port                   | 5432                     |
| DB_NAME        | Database name                     | critiq_db                |
| DB_USER        | Database user                     | postgres                 |
| DB_PASSWORD    | Database password                 | yourpassword             |
| JWT_SECRET     | Secret for signing JWTs           | long-random-string       |
| JWT_EXPIRES_IN | Token expiry                      | 7d                       |
| CLIENT_URL     | Frontend origin (CORS)            | http://localhost:5173    |

## Deploying the API to Render

The local PostgreSQL server on your laptop is separate from a hosted database. Render cannot connect to it using `localhost`.

1. Create or select a hosted PostgreSQL database. For Render Postgres, place it in the same region as the API and copy its **Internal Database URL**.
2. In the Render web service's Environment settings, set `DATABASE_URL` to that URL. This takes precedence over `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. Do not commit the URL.
3. Set `NODE_ENV=production`, `CLIENT_URL` to the deployed frontend origin, and `API_PUBLIC_URL` to the deployed API origin. Set `GITHUB_CALLBACK_URL` to the deployed API origin followed by `/api/auth/github/callback`, and update the GitHub OAuth application to match. Configure the other authentication secrets in Render, not in Git.
4. Run `npm run db:init` against the hosted database to initialize its tables, then deploy with `npm start`. Initializing a hosted database does not copy existing local users or reviews. To preserve those records in the hosted database, plan a PostgreSQL dump/restore separately before initializing or migrating the destination.
5. Set the deployed frontend's `VITE_API_URL` to the API origin followed by `/api`, then rebuild the frontend.

For external database providers, use their documented TLS parameters in `DATABASE_URL`; the app does not disable certificate verification. An internal Render database hostname is intended for services on Render's private network, not your laptop.

Reference: https://render.com/docs/postgresql-creating-connecting

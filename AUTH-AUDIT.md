# Authentication audit and setup

## What the project uses

There is no Passport, Auth.js, or hosted authentication framework. The API is Express 4 with custom controllers, express-validator, bcryptjs, jsonwebtoken, and PostgreSQL through `pg`. SQL lives in controllers; there is no ORM or separate user model implementation. The React/Vite client uses AuthContext, React Router guards, and a shared fetch client.

The browser still stores its API bearer token in localStorage. It now restores user identity from `/api/auth/me`, never from the cached profile alone. Access JWTs have a dedicated `kind=access` and a random `jti` backed by `auth_sessions`. Every protected request checks the session and the current database role. Logout deletes just that session; password reset deletes all sessions for the account.

Relevant database objects: existing `users` (unique email, bcrypt password hash, requester/reviewer/admin/suspended role); new unique `users.github_id`; case-insensitive email uniqueness; `auth_sessions`; `github_handoffs`; and `password_reset_tokens`. Migrations are additive and refuse case-only email collisions instead of merging accounts.

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register` | Validate name, email, password, and role; create account and session |
| `POST /api/auth/login` | Validate credentials; reject suspended accounts; create session |
| `GET /api/auth/me` | Validate session and return current profile |
| `POST /api/auth/logout` | Revoke the current session |
| `GET /api/auth/github?role=requester` | Start GitHub OAuth; `reviewer` is also accepted |
| `GET /api/auth/github/callback` | Validate browser-bound state, exchange code with PKCE, resolve GitHub identity |
| `POST /api/auth/github/session` | Exchange a one-minute HTTP-only handoff cookie once, from the configured frontend origin |
| `POST /api/auth/forgot-password` | Send a reset email; never return a reset credential |
| `POST /api/auth/reset-password` | Atomically consume the reset credential, change password, revoke sessions |
| Frontend `/auth/callback` | Complete the cookie handoff and restore the requested destination |

## Confirmed issues and changes

Reproduction tests were run before the relevant fixes. The first backend run failed on browser-unbound OAuth state, missing validation messages, suspended-account login, state-token acceptance, and public reset credentials. Later runs reproduced stale roles, missing logout, overlong-name database errors, email normalization failures, cached expired sessions, and hidden validation messages. The missing callback route, hardcoded provider URL, absent GitHub registration button, email-only provider identity, and unused provider error query were also confirmed by tracing the source. A follow-up test reproduced crafted URL-token login before replacing that intermediate handoff.

| Issue and root cause | Fix and principal files | Verification |
| --- | --- | --- |
| GitHub could not finish: backend redirected to an undefined frontend route; login ignored `?error`; the button hardcoded localhost; signup had no GitHub entry | `backend/src/controllers/github.controller.js`, `backend/src/routes/auth.routes.js`, `frontend/src/api/auth.ts`, `frontend/src/app/pages/{AuthCallback,Login,Register}.tsx`, `frontend/src/app/App.tsx` | HTTP callback/account tests; React signup, callback, visible error, and StrictMode tests |
| OAuth state was signed but not bound to its initiating browser; credentials and profile were returned in the URL | Cryptographic state, signed HTTP-only SameSite cookie, PKCE, timeout/error redirects, and a single-use hashed handoff cookie. No access token or profile in the callback URL | Missing/wrong browser state, cancellation, exchange outage, wrong origin, missing/expired/replayed handoff, and crafted callback-link tests |
| Provider accounts were matched only by mutable email; public profile email was trusted without checking verification; a matching password account was silently linked | Persist numeric GitHub ID; query verified email list for new accounts; reject email collisions with a sign-in instruction; retain signup role; block suspension. `backend/src/config/authSchema.sql` | Returning GitHub identity after email changes; verified/private email; no verified email; case-insensitive collision; selected role; suspended account tests |
| Validation returned raw arrays (including submitted password values), while the client only read `error`/`message`. Name length was unbounded; bcrypt silently truncates inputs over 72 bytes | Shared `authValidation.js` and `validate.js`; limits and type checks; safe field messages; client parsing; form feedback. Trim input while preserving the original email-normalization rules; support old unnormalized provider emails; a unique lower-email index handles races | Invalid fields/types, name/password lengths including UTF-8, legacy normalized-address login, signup/hash, wrong password, duplicate and concurrent registration tests |
| Sessions trusted local cached users and JWT role claims; no server logout existed; any signed token kind passed the guard | `backend/src/utils/tokens.js`, `backend/src/middleware/auth.js`, `auth.controller.js`, `frontend/src/app/context/AuthContext.tsx`, `frontend/src/api/client.ts`, `AppSidebar.tsx`; live role lookup and revocation | Reload, corrupt cache, expiry, missing/deleted session/user, suspension, role downgrade, logout and other-device session, offline retry, cross-tab sign-out tests |
| Protected routes discarded the destination; signed-in visitors could remain on login/signup | `frontend/src/app/components/AuthGuards.tsx`, `frontend/src/app/utils/authRedirect.ts`, auth forms and callback; allow only local destinations | Protected destination, external redirect rejection, authenticated public-route redirect and non-admin guard tests |
| Anonymous forgot-password returned a usable stateless JWT for any account; tokens were reusable; no email was sent | `passwordReset.controller.js`, `passwordReset.routes.js`, `backend/src/services/email.js`, reset pages and client. Email-only random credentials stored as hashes; expiry, atomic redemption, and session revocation | Simulated delivery, equal public response for missing accounts/delivery failure, no credentials in responses, old JWT rejection, replacement/expiry, concurrent redemption, new-password login and old-session rejection |
| Placeholder JWT key was accepted; provider failures could expose internals | Startup `authConfig.js`, `server.js`, safe `errorHandler.js`, `.env.example` files, secret-generation helper | Missing/weak key and unsafe URL validation; local config check identified the existing placeholder key without printing it |

Supporting changes: `backend/src/config/migrateAuth.js`, `initDb.js` (nonzero exit on failure), package scripts, `backend/src/app.js` (normalized CORS origin), backend/React test suites. `jsdom` is the only added dependency, for tests; no dependency upgrades or UI redesign were made.

## Verification and limits

- Backend integration tests use real HTTP routes, bcrypt/JWT code, and a real PostgreSQL schema created exclusively for the test run and dropped afterward. They never modify application users. GitHub and email HTTP responses are simulated; the application CORS middleware is also tested.
- Frontend tests mount actual React components in jsdom, submit forms, exercise routing and context, and simulate API responses. These are not real-browser cookie tests.
- `npm.cmd test` passes in each folder: 26 backend tests and 23 React tests. The frontend production build also passes.
- The additive authentication migration was applied successfully to the local database. Other databases need `npm.cmd run db:auth`; new databases can use `npm.cmd run db:init`.
- No live GitHub consent/code exchange or real email delivery was performed. The GitHub credentials are present locally, but their validity and the OAuth App's registered callback cannot be confirmed without completing provider authorization. No interactive browser testing was available in this session.
- Existing access tokens and old reset links must be replaced by a fresh sign-in/reset. Existing GitHub-created rows lacking `github_id` cannot safely be inferred or linked by email. Use password recovery for such accounts; automatic account linking remains intentionally unsupported.
- Previously stored email addresses are not rewritten. Login and recovery preserve the prior email-normalization rules, with a fallback for unnormalized email addresses from older provider accounts.
- Bearer tokens remain in localStorage, so this does not eliminate the existing exposure to same-origin script compromise. The audit did not implement email verification for password signup or redesign the session transport.

## Local configuration

Your local callback and frontend origin already match the values below. Keep all secret values only in `backend/.env`; do not put provider secrets into Vite variables.

1. Replace the placeholder signing secret without printing it. From `backend` run:

   ```powershell
   npm.cmd run auth:secret
   ```

   This writes a fresh 64-character hexadecimal `JWT_SECRET` directly to `.env`, preserving the other settings. It was tested using a temporary file; it has **not** been run against your real `.env`. Restarting with the new key invalidates existing JWTs.

2. In GitHub **Settings → Developer settings → OAuth Apps**, create or update the app:

   | GitHub setting | Exact local value |
   | --- | --- |
   | Homepage URL | `http://localhost:5173` |
   | Authorization callback URL | `http://localhost:5000/api/auth/github/callback` |

   Configure these backend values:

   ```dotenv
   CLIENT_URL=http://localhost:5173
   API_PUBLIC_URL=http://localhost:5000
   GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
   GITHUB_CLIENT_ID=<OAuth App client ID>
   GITHUB_CLIENT_SECRET=<OAuth App client secret>
   JWT_EXPIRES_IN=7d
   ```

   The callback points to the **backend**, not the frontend `/auth/callback`. State, PKCE and the `read:user user:email` scopes are configured by the application, following [GitHub's OAuth flow documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

3. Password-reset email is not configured locally. The implemented delivery adapter uses [Resend's email API](https://resend.com/express). Configure:

   ```dotenv
   RESEND_API_KEY=<Resend sending API key, typically re_...>
   EMAIL_FROM=Critiq <no-reply@your-verified-domain.example>
   RESET_TOKEN_TTL_MINUTES=60
   ```

   Verify the sending domain in Resend and use its real sender address. Reset TTL accepts integers 1–60 minutes. The old `RESET_TOKEN_EXPIRES_IN` setting is no longer used. Without mail configuration, forgot-password returns a clear unavailable message instead of exposing a reset token or falsely claiming email delivery.

4. If necessary, set `frontend/.env` to `VITE_API_URL=http://localhost:5000/api`; this is already the default. Restart Vite after changing its environment.

5. Keep the existing PostgreSQL variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Runtime variables are `PORT` and `NODE_ENV`.

Run PostgreSQL, then `npm.cmd run dev` in separate backend and frontend terminals. On another checkout/database, run the migration first. Frontend tests require `npm.cmd install` to install the added test dependency. Backend tests require PostgreSQL credentials with permission to create and remove a test schema.

## Manual acceptance checks

After configuration, test in a real browser at `http://localhost:5173`:

1. Sign up with GitHub as requester and reviewer using distinct test accounts. Approve access, verify the resulting identity/role, reload, sign out, and sign in again. Confirm no token appears in the frontend URL.
2. Cancel GitHub consent; verify a readable login error. Test private verified email and an email collision with a password account. A collision must not silently link accounts.
3. Follow a protected review link while signed out; sign in with email/password and verify return to that route. Try invalid credentials, duplicate signup, reload, another-tab sign-out, and the admin route as a non-admin.
4. Request password recovery and confirm actual inbox delivery. Open the emailed link, reset the password, verify old sessions/password no longer work, and verify reusing the link fails.

For production, use HTTPS frontend/API origins on the same site (for example `app.example.com` and `api.example.com`) so SameSite=Lax handoff cookies work. Configure the GitHub callback with the public API origin and ensure the frontend host serves the SPA for `/auth/callback` and `/reset-password`. Cross-site frontend/API cookie deployment has not been implemented or verified.

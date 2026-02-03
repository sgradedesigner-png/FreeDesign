You are working on a production eCommerce.

STACK:
- Frontend: React + Vite + TypeScript + shadcn/ui
- Backend: Fastify API
- Auth: Supabase Auth (email/password)
- DB: Supabase Postgres

GOAL:
Implement authentication with:
1) Login using Email + Password
2) Signup using Email + Password + email verification
3) Forgot Password (password reset) using email recovery link
4) Checkout gate: if user clicks Checkout and is not authenticated -> show Auth Modal (Login/Signup tabs). After auth success -> continue checkout.

REQUIREMENTS:

A) SIGNUP:
- Create user with email+password
- Require email confirmation (Supabase email confirmation)
- After signup show a message: "Check your email to confirm your account"
- Do not auto-login if email not confirmed

B) LOGIN:
- Email + password
- Show errors nicely (invalid credentials, etc)

C) FORGOT PASSWORD:
- In Login tab, add "Forgot password?"
- Ask for email, call supabase.auth.resetPasswordForEmail(email, { redirectTo })
- redirectTo must point to FRONTEND route: /auth/reset
- When user clicks email link, open /auth/reset page in our app
- On /auth/reset page:
  - Show form to set new password + confirm password
  - Call supabase.auth.updateUser({ password })
  - On success: show message and link to login

D) CHECKOUT GATE:
- When user clicks Checkout/Pay:
  - if no session -> open AuthModal
  - after successful login -> continue checkout

IMPLEMENTATION DETAILS:

1) Create Supabase client module if not exists:
- src/lib/supabaseClient.ts

2) Frontend Components:
- src/components/auth/AuthModal.tsx
  - Tabs: Login | Sign up
  - Login form: email, password, submit
  - Signup form: email, password, confirm password, submit
  - Include "Forgot password?" opens ForgotPasswordDialog
- src/components/auth/ForgotPasswordDialog.tsx
  - email input
  - calls resetPasswordForEmail
  - success state: "We sent you a reset link"
- src/pages/AuthResetPassword.tsx
  - route: /auth/reset
  - set new password + confirm
  - call supabase.auth.updateUser({ password })
  - handle "no recovery session" case: show message "Invalid/expired link"

3) Routing:
- Add route for /auth/reset to render AuthResetPassword page

4) Checkout integration:
- Create hook: src/hooks/useCheckoutGate.ts
  - Function that takes a callback proceedCheckout()
  - checks supabase.auth.getSession()
  - if no session -> open AuthModal and resolve after login
  - then call proceedCheckout()

5) Backend:
- Create Fastify auth guard verifying Supabase JWT using Supabase JWKS or SUPABASE_JWT_SECRET (whichever is already used in this repo)
- Add endpoint POST /api/checkout/session that requires auth (stub ok)

UI:
- Use shadcn/ui components (Dialog, Tabs, Input, Button)
- Keep design consistent with existing project (dark mode supported)
- Clear error messages and loading states

DELIVERABLE:
- Implement all new files and update existing files accordingly
- Provide final code changes (complete file contents)
- No explanations, only code.

Before writing code:
- Search the repo for existing auth/supabase usage and reuse patterns.

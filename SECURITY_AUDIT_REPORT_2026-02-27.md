# Security Audit Report: ecommerce-platform

**Audit Date**: 2026-02-27  
**Auditor**: Codex Security Senior Checker  
**Scope**: `backend` (Fastify/TypeScript), env/config, secrets exposure

## Executive Summary
- 🔴 Critical: 1
- 🟠 High: 1
- 🟡 Medium: 1
- 🔵 Low: 1

## Findings

### 🔴 CRITICAL-001: Secrets committed in repository
**Location**
- `OAuthGoogle.env:2`
- `backend/Implementation Plan DTF Site.md:86`

**Risk**
- OAuth Client Secret and Cloudinary API Secret are present in versioned files.
- Any repo access can lead to unauthorized third-party access.

**Remediation**
1. Rotate leaked credentials immediately (Google, Cloudinary).
2. Remove secrets from tracked files and scrub git history.
3. Add non-standard secret filenames (e.g. `OAuthGoogle.env`) to `.gitignore`.
4. Enable pre-commit secret scanning (`gitleaks`/`trufflehog`).

---

### 🟠 HIGH-001: Incomplete payment-to-order binding in payment callback
**Location**
- `backend/src/routes/payment.ts:96`
- `backend/src/routes/payment.ts:157`
- `backend/src/routes/payment.ts:191`

**Risk**
- Callback verifies `payment_id` via QPay, but does not strictly bind the returned payment reference to the target order invoice in all flows.
- This can create business-logic abuse risk if a valid payment ID is replayed against another order under edge conditions.

**Remediation**
1. Enforce strict invoice binding: payment response invoice/order reference must equal `order.qpayInvoiceId`.
2. Verify callback signature/HMAC if supported by QPay.
3. Treat external invoice reference as source of truth, not incoming callback body identifiers.

---

### 🟡 MEDIUM-001: Auth error details exposed to clients
**Location**
- `backend/src/middleware/userGuard.ts:61`
- `backend/src/supabaseauth.ts:79`

**Risk**
- Raw error messages are returned in auth failures.
- Information disclosure helps reconnaissance and can leak internals.

**Remediation**
1. Return generic `401 Unauthorized`/`403 Forbidden` only.
2. Keep detailed error data only in logs/Sentry.
3. Normalize auth failure status mapping.

---

### 🔵 LOW-001: Public operational endpoints expose internal details
**Location**
- `backend/src/app.ts:116` (`/docs`)
- `backend/src/app.ts:354` (`/health/details`)
- `backend/src/app.ts:455` (`/metrics`)
- `backend/src/app.ts:522` (`/circuit-breakers`)

**Risk**
- Exposes API surface and runtime/infra status to unauthenticated users.

**Remediation**
1. Restrict with admin auth or allowlist in production.
2. Disable `/docs` in production.
3. Keep public health responses minimal.

## Dependency Audit Status
`npm audit` was executed for `backend`, `apps/admin`, and `apps/store`, but npm advisory endpoint requests failed in this environment. CVE results are incomplete and should be rerun in a network-enabled environment.

## Remediation Priority
1. Fix CRITICAL secret leakage and rotate credentials immediately.
2. Patch payment callback binding logic in current sprint.
3. Harden auth error responses.
4. Restrict production operational endpoints.

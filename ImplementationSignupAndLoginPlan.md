# Implementation Plan: Signup and Login System

## Project Overview
**Goal:** Implement complete authentication system with Signup, Login, Password Reset, and Checkout Gate for the eCommerce store app.

**Tech Stack:**
- Frontend: React 19.2.0 + Vite + TypeScript + shadcn/ui
- Backend: Fastify API
- Auth: Supabase Auth (email/password)
- Database: Supabase PostgreSQL
- Current Status: ✅ Supabase configured | ❌ No customer auth UI

---

## Phase 1: Foundation & Auth Infrastructure

### Tasks

#### 1.1 Create Auth Context Provider
**File:** `apps/store/src/context/AuthContext.tsx`

**Purpose:** Centralized authentication state management

**Implementation:**
- Create AuthContext with user session state
- Implement useAuth hook for consuming auth state
- Listen to Supabase auth state changes via `onAuthStateChange`
- Store current user, session, and loading states
- Provide login, signup, logout functions
- Handle session persistence across page reloads

**Interface:**
```typescript
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
}
```

**Dependencies:**
- `src/lib/supabase.ts` (already exists)
- Supabase JS SDK methods: `signInWithPassword`, `signUp`, `signOut`, `resetPasswordForEmail`, `updateUser`

---

#### 1.2 Integrate AuthProvider into App
**File:** `apps/store/src/App.tsx`

**Changes:**
- Import AuthProvider
- Wrap existing providers with AuthProvider (outermost layer)
- Order: `AuthProvider > ThemeProvider > WishlistProvider > CartProvider`

**Reason:** Auth needs to be available before any component renders

---

#### 1.3 Update Header with Auth UI
**File:** `apps/store/src/components/layout/Header.tsx`

**Changes:**
- Add Login/Signup button when user is NOT authenticated
- Add User dropdown menu when authenticated
  - Show user email
  - Logout button
  - Future: Profile, Orders links
- Position: Between language selector and theme toggle

**UI Components Needed:**
- `Button` (shadcn)
- `DropdownMenu` (shadcn)
- `Avatar` (shadcn - optional)

---

## Phase 2: Core Authentication Components

### Tasks

#### 2.1 Create AuthModal Component
**File:** `apps/store/src/components/auth/AuthModal.tsx`

**Purpose:** Modal with Login/Signup tabs

**Features:**
- Dialog overlay (shadcn `Dialog`)
- Tabs for "Login" and "Sign Up" (shadcn `Tabs`)
- Accept `isOpen` and `onClose` props
- Optional `defaultTab` prop ("login" | "signup")
- Call useAuth hook for form submissions
- Display error messages from Supabase
- Show loading states during API calls

**Components Used:**
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Input`, `Button`, `Label`
- `Alert` for error messages

---

#### 2.2 Create Login Form
**File:** `apps/store/src/components/auth/LoginForm.tsx`

**Fields:**
- Email (required, email validation)
- Password (required, min 6 chars)
- "Forgot Password?" link
- Submit button

**Behavior:**
- Call `login(email, password)` from useAuth
- Handle Supabase errors:
  - Invalid credentials → "Invalid email or password"
  - Email not confirmed → "Please confirm your email address"
  - Network error → "Connection failed. Please try again."
- On success → close modal, show success toast
- Loading state: disable inputs and show spinner on button

**Validation:**
- Client-side validation before API call
- Show inline error messages

---

#### 2.3 Create Signup Form
**File:** `apps/store/src/components/auth/SignupForm.tsx`

**Fields:**
- Email (required, email validation)
- Password (required, min 8 chars, show strength indicator)
- Confirm Password (must match password)
- Submit button

**Behavior:**
- Call `signup(email, password)` from useAuth
- Supabase config: `emailRedirectTo` not needed (email confirmation only)
- Handle errors:
  - User already exists → "This email is already registered"
  - Weak password → Show password requirements
  - Network error → Generic error message
- On success:
  - Do NOT auto-login (Supabase prevents if email not confirmed)
  - Show success message: "Check your email to confirm your account"
  - Keep modal open with message for 3 seconds, then close
- Loading state during submission

**Validation:**
- Email format validation
- Password strength requirements (8+ chars, 1 uppercase, 1 number)
- Password match validation
- Show real-time validation feedback

---

#### 2.4 Create Forgot Password Dialog
**File:** `apps/store/src/components/auth/ForgotPasswordDialog.tsx`

**Purpose:** Standalone dialog for password reset request

**Features:**
- Single email input field
- Submit button
- Success/error states
- Called from Login form "Forgot Password?" link

**Flow:**
1. User enters email
2. Call `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
3. `redirectTo`: `${window.location.origin}/auth/reset`
4. Show success message: "We sent you a password reset link. Check your email."
5. Close dialog after 3 seconds

**Error Handling:**
- Show error if email is invalid
- Show generic success message even if email doesn't exist (security best practice)

**Components:**
- `Dialog`, `DialogContent`, `DialogHeader`
- `Input`, `Button`, `Alert`

---

## Phase 3: Password Reset Flow

### Tasks

#### 3.1 Create Password Reset Page
**File:** `apps/store/src/pages/AuthResetPassword.tsx`

**Route:** `/auth/reset`

**Purpose:** Page where users land from email reset link

**Features:**
- Check if recovery session exists via Supabase
- Show form with:
  - New password input
  - Confirm password input
  - Submit button
- Call `supabase.auth.updateUser({ password: newPassword })`
- Handle success/error states

**States:**
1. **Loading:** Check session on mount
2. **No Session:** Show error "Invalid or expired reset link" + link to homepage
3. **Valid Session:** Show password reset form
4. **Success:** Show "Password updated successfully!" + link to login
5. **Error:** Show error message

**Validation:**
- Password requirements (8+ chars, strong password)
- Passwords must match
- Show real-time validation

**Components:**
- `Card` for centered form layout
- `Input`, `Button`, `Alert`
- `Link` to redirect back

---

#### 3.2 Add Reset Password Route
**File:** `apps/store/src/App.tsx`

**Changes:**
- Import `AuthResetPassword` page
- Add route: `<Route path="/auth/reset" element={<AuthResetPassword />} />`
- Place outside authenticated routes (public route)

---

## Phase 4: Checkout Authentication Gate

### Tasks

#### 4.1 Create useCheckoutGate Hook
**File:** `apps/store/src/hooks/useCheckoutGate.ts`

**Purpose:** Protect checkout flow - require authentication

**Implementation:**
```typescript
export function useCheckoutGate() {
  const { user, session } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const callbackRef = useRef<(() => void) | null>(null)

  const checkAuthAndProceed = (callback: () => void) => {
    if (!user || !session) {
      callbackRef.current = callback
      setShowAuthModal(true)
    } else {
      callback()
    }
  }

  const onAuthSuccess = () => {
    setShowAuthModal(false)
    if (callbackRef.current) {
      callbackRef.current()
      callbackRef.current = null
    }
  }

  return {
    checkAuthAndProceed,
    showAuthModal,
    setShowAuthModal,
    onAuthSuccess
  }
}
```

**Behavior:**
- Check if user is authenticated
- If YES → immediately execute checkout callback
- If NO → show AuthModal, save callback
- After successful auth → execute callback, close modal

---

#### 4.2 Create Checkout Page
**File:** `apps/store/src/pages/CheckoutPage.tsx`

**Purpose:** Protected checkout page

**Features:**
- Display cart summary
- Shipping form
- Payment method selection
- "Place Order" button → triggers authenticated API call
- Use useCheckoutGate hook

**Flow:**
1. User lands on /checkout
2. Check authentication
3. If not authenticated → show AuthModal
4. After auth → continue checkout
5. On "Place Order" → POST to `/api/checkout/session` with JWT

---

#### 4.3 Add Checkout Route
**File:** `apps/store/src/App.tsx`

**Changes:**
- Add route: `<Route path="/checkout" element={<CheckoutPage />} />`

---

#### 4.4 Update Cart Page "Checkout" Button
**File:** `apps/store/src/pages/CartPage.tsx`

**Changes:**
- Import useCheckoutGate hook
- Wrap checkout navigation with auth check
- Show AuthModal if not authenticated
- On auth success → navigate to `/checkout`

**Before:**
```typescript
<Button onClick={() => navigate('/checkout')}>
  Proceed to Checkout
</Button>
```

**After:**
```typescript
const { checkAuthAndProceed, showAuthModal, setShowAuthModal, onAuthSuccess } = useCheckoutGate()

<Button onClick={() => checkAuthAndProceed(() => navigate('/checkout'))}>
  Proceed to Checkout
</Button>

<AuthModal
  isOpen={showAuthModal}
  onClose={() => setShowAuthModal(false)}
  onSuccess={onAuthSuccess}
/>
```

---

## Phase 5: Backend Checkout Endpoint

### Tasks

#### 5.1 Create Checkout Session Endpoint
**File:** `backend/src/routes/checkout.ts`

**Endpoint:** `POST /api/checkout/session`

**Protection:** Apply adminGuard or create new userGuard middleware

**Purpose:** Create checkout session for authenticated users

**Implementation:**
```typescript
fastify.post('/api/checkout/session', {
  preHandler: [userGuard] // Verify JWT, any authenticated user
}, async (request, reply) => {
  const userId = request.user.id
  const { items, total } = request.body

  // Validate cart items
  // Create order in database
  // Return session data

  return { sessionId: 'stub', total }
})
```

**Requirements:**
- Verify JWT token from Supabase
- Extract user ID from token
- Validate cart items (stock, prices)
- Create Order record in database
- Return checkout session data

---

#### 5.2 Create User Guard Middleware
**File:** `backend/src/middleware/userGuard.ts`

**Purpose:** Verify authenticated users (not just admins)

**Implementation:**
```typescript
export async function userGuard(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }

  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return reply.code(401).send({ error: 'Invalid token' })
  }

  req.user = user // Attach to request
}
```

**Difference from adminGuard:**
- Does NOT check Profile.role
- Only verifies valid Supabase JWT
- Any confirmed user can access

---

#### 5.3 Register Checkout Routes
**File:** `backend/src/index.ts`

**Changes:**
- Import checkout routes
- Register: `await fastify.register(checkoutRoutes, { prefix: '/api/checkout' })`

---

## Phase 6: UI/UX Enhancements

### Tasks

#### 6.1 Add Loading States
**Files:** All auth components

**Requirements:**
- Show spinner on buttons during async operations
- Disable form inputs during submission
- Show skeleton loaders where appropriate
- Use shadcn `Button` with `disabled` and `isLoading` props

---

#### 6.2 Add Error Handling
**Files:** All auth components

**Requirements:**
- Display user-friendly error messages
- Map Supabase error codes to readable messages
- Use shadcn `Alert` component for errors
- Add error boundary for unexpected crashes

**Error Mapping:**
```typescript
const AUTH_ERRORS = {
  'Invalid login credentials': 'Invalid email or password',
  'Email not confirmed': 'Please confirm your email address',
  'User already registered': 'This email is already registered',
  'Password too weak': 'Password must be at least 8 characters',
  // etc.
}
```

---

#### 6.3 Add Success Notifications
**Library:** `sonner` (already installed)

**Usage:**
- Login success → "Welcome back!"
- Signup success → "Account created! Check your email to confirm."
- Logout success → "Logged out successfully"
- Password reset sent → "Password reset link sent to your email"
- Password updated → "Password updated successfully!"

**Implementation:**
```typescript
import { toast } from 'sonner'

toast.success('Welcome back!')
```

---

#### 6.4 Add Form Validation
**Library:** Consider using `zod` + `react-hook-form` for complex forms

**Validation Rules:**
- Email: valid email format
- Password: min 8 chars, 1 uppercase, 1 number, 1 special char
- Confirm password: must match password

**Show:**
- Real-time validation feedback
- Inline error messages
- Field-level validation on blur

---

#### 6.5 Dark Mode Support
**Files:** All new components

**Requirements:**
- Use existing ThemeContext
- Apply Tailwind dark mode classes
- Test all components in both light/dark modes
- Ensure contrast ratios meet accessibility standards

---

## Phase 7: Testing & Validation

### Tasks

#### 7.1 Test Signup Flow
**Test Cases:**
1. Valid signup → receive confirmation email
2. Duplicate email → show error
3. Weak password → show requirements
4. Passwords don't match → show error
5. Network error → show retry option
6. Email confirmation link → verify account activated

---

#### 7.2 Test Login Flow
**Test Cases:**
1. Valid credentials → successful login
2. Invalid credentials → show error
3. Unconfirmed email → show error and resend option
4. Forgot password link → opens dialog
5. Session persistence → refresh page, user still logged in

---

#### 7.3 Test Password Reset Flow
**Test Cases:**
1. Request reset → email received
2. Click email link → lands on /auth/reset
3. Enter new password → success
4. Expired link → show error
5. Invalid link → show error
6. Try logging in with new password → success

---

#### 7.4 Test Checkout Gate
**Test Cases:**
1. Not logged in → click checkout → AuthModal appears
2. Login via modal → modal closes, proceed to checkout
3. Already logged in → click checkout → direct to checkout page
4. Session expires during checkout → show auth modal

---

#### 7.5 Test Backend Protection
**Test Cases:**
1. Call `/api/checkout/session` without token → 401 Unauthorized
2. Call with invalid token → 401 Unauthorized
3. Call with valid token → 200 OK with session data
4. Call with expired token → 401 Unauthorized

---

## Phase 8: Security & Polish

### Tasks

#### 8.1 Security Hardening
**Checklist:**
- ✅ JWT tokens stored securely (httpOnly if possible via Supabase)
- ✅ HTTPS enforced in production
- ✅ CORS configured correctly
- ✅ Rate limiting on auth endpoints (Supabase handles this)
- ✅ XSS protection (React auto-escapes)
- ✅ CSRF protection (check if needed)
- ✅ Password strength requirements enforced
- ✅ Email verification required before login

---

#### 8.2 Accessibility (a11y)
**Requirements:**
- All forms keyboard navigable
- Proper ARIA labels on inputs
- Focus management in modals
- Screen reader friendly error messages
- Color contrast compliance (WCAG AA)

---

#### 8.3 Performance Optimization
**Optimizations:**
- Lazy load auth components
- Debounce password strength checker
- Cache Supabase session in memory
- Minimize re-renders in AuthContext
- Code-split auth routes

---

#### 8.4 Internationalization (i18n)
**Current:** Mongolian/English toggle exists

**Tasks:**
- Add translations for all auth strings
- Store in existing translation system
- Support both languages in:
  - Auth forms
  - Error messages
  - Success messages
  - Email templates (Supabase dashboard config)

---

## Phase 9: Documentation & Deployment

### Tasks

#### 9.1 Code Documentation
**Files to document:**
- AuthContext - JSDoc comments
- useCheckoutGate hook - usage examples
- Auth components - prop interfaces
- Backend userGuard - explain JWT flow

---

#### 9.2 Environment Variables Checklist
**Verify all envs are set:**

**.env (store):**
```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000
```

**.env (backend):**
```
SUPABASE_URL=your-project-url
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=your-database-url
CORS_ORIGIN=http://localhost:5176
```

---

#### 9.3 Supabase Dashboard Configuration
**Email Templates:**
1. Confirmation Email
   - Subject: "Confirm your email"
   - Link to: Supabase default (verifies account)
2. Password Reset Email
   - Subject: "Reset your password"
   - Link to: `{{ .SiteURL }}/auth/reset`

**Auth Settings:**
1. Enable Email provider
2. Set Site URL: production domain
3. Set Redirect URLs: `https://yourdomain.com/auth/reset`
4. Email confirmation: REQUIRED
5. Secure email change: ENABLED
6. Disable signup: NO (allow public signup)

---

#### 9.4 Deployment Checklist
**Pre-deployment:**
- [ ] All tests passing
- [ ] No console errors
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables set in hosting platform
- [ ] Supabase production project configured
- [ ] CORS configured for production domain
- [ ] Email templates customized with branding

**Post-deployment:**
- [ ] Test signup on production
- [ ] Test login on production
- [ ] Test password reset on production
- [ ] Test checkout gate on production
- [ ] Verify emails are being sent
- [ ] Check error tracking (Sentry, etc.)

---

## File Structure Summary

### New Files to Create

**Frontend (apps/store/src/):**
```
context/
  AuthContext.tsx                      # Auth state management

components/
  auth/
    AuthModal.tsx                       # Login/Signup modal
    LoginForm.tsx                       # Login form component
    SignupForm.tsx                      # Signup form component
    ForgotPasswordDialog.tsx            # Password reset dialog

pages/
  AuthResetPassword.tsx                 # Password reset page
  CheckoutPage.tsx                      # Checkout page

hooks/
  useCheckoutGate.ts                    # Checkout auth gate hook
```

**Backend (backend/src/):**
```
routes/
  checkout.ts                           # Checkout API routes

middleware/
  userGuard.ts                          # User authentication guard
```

### Files to Modify

**Frontend:**
```
src/App.tsx                             # Add AuthProvider, routes
src/components/layout/Header.tsx        # Add auth UI
src/pages/CartPage.tsx                  # Add checkout gate
```

**Backend:**
```
src/index.ts                            # Register checkout routes
```

---

## Implementation Order (Recommended)

1. **Day 1-2:** Phase 1 (Foundation)
   - AuthContext
   - Integrate into App
   - Update Header

2. **Day 3-4:** Phase 2 (Auth Components)
   - AuthModal
   - LoginForm
   - SignupForm
   - ForgotPasswordDialog

3. **Day 5:** Phase 3 (Password Reset)
   - AuthResetPassword page
   - Add route
   - Test flow

4. **Day 6:** Phase 4 (Checkout Gate)
   - useCheckoutGate hook
   - CheckoutPage
   - Update CartPage

5. **Day 7:** Phase 5 (Backend)
   - userGuard middleware
   - Checkout endpoint
   - Register routes

6. **Day 8-9:** Phase 6 (UX Enhancements)
   - Loading states
   - Error handling
   - Notifications
   - Form validation
   - Dark mode

7. **Day 10-11:** Phase 7 (Testing)
   - All test cases
   - Bug fixes

8. **Day 12:** Phase 8 (Security & Polish)
   - Security audit
   - Accessibility
   - Performance
   - i18n

9. **Day 13:** Phase 9 (Deployment)
   - Documentation
   - Supabase config
   - Deploy

---

## Success Criteria

### Must Have (MVP)
- ✅ Users can sign up with email + password
- ✅ Email confirmation required before login
- ✅ Users can log in with email + password
- ✅ Users can request password reset via email
- ✅ Users can set new password via reset link
- ✅ Checkout requires authentication
- ✅ Backend verifies JWT for protected routes
- ✅ Session persists across page reloads

### Nice to Have (Post-MVP)
- Social login (Google, GitHub)
- Profile management page
- Order history page
- Email preferences
- Two-factor authentication
- Remember me option
- Account deletion

---

## Dependencies

### NPM Packages (Already Installed)
- `@supabase/supabase-js`: ^2.93.1
- `sonner`: ^2.0.7 (toast notifications)
- `react-router-dom`: ^7.12.0
- shadcn/ui components

### May Need to Install
- `zod`: For form validation schemas
- `react-hook-form`: For complex form handling
- `@hookform/resolvers`: For zod integration

---

## Risk Mitigation

### Potential Issues & Solutions

**Issue 1:** Email confirmation not received
- **Solution:** Check Supabase email settings, verify email provider configured, check spam folder

**Issue 2:** Session expires during checkout
- **Solution:** Implement token refresh logic in AuthContext

**Issue 3:** CORS errors on production
- **Solution:** Configure backend CORS_ORIGIN with production domain

**Issue 4:** JWT verification fails
- **Solution:** Ensure SUPABASE_JWT_SECRET matches Supabase project settings

**Issue 5:** Password reset link expires before user clicks
- **Solution:** Increase token expiry time in Supabase settings (default 1 hour)

---

## Monitoring & Analytics

### Track These Metrics
- Signup conversion rate
- Login success rate
- Password reset request rate
- Checkout abandonment rate (auth gate impact)
- Email confirmation rate
- Time to first purchase after signup

### Error Tracking
- Failed login attempts
- Signup errors
- Password reset errors
- JWT verification failures
- Checkout authentication errors

---

## Future Enhancements

### Phase 10: Advanced Features (Post-Launch)
1. **Social Authentication**
   - Google OAuth
   - GitHub OAuth
   - Apple Sign In

2. **User Profile Management**
   - Update email
   - Update password
   - Profile picture upload
   - Shipping addresses
   - Payment methods

3. **Enhanced Security**
   - Two-factor authentication (2FA)
   - Magic link login (passwordless)
   - Device management
   - Login history

4. **Order Management**
   - Order history page
   - Order tracking
   - Invoice download
   - Reorder functionality

5. **Email Enhancements**
   - Welcome email after signup
   - Order confirmation emails
   - Shipping updates
   - Marketing emails (with unsubscribe)

---

## Appendix

### A. Supabase Auth API Reference
```typescript
// Signup
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    emailRedirectTo: 'https://example.com/welcome',
  }
})

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
})

// Logout
const { error } = await supabase.auth.signOut()

// Password reset request
const { data, error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  { redirectTo: 'https://example.com/auth/reset' }
)

// Update password
const { data, error } = await supabase.auth.updateUser({
  password: 'newpassword123'
})

// Get session
const { data: { session } } = await supabase.auth.getSession()

// Get user
const { data: { user } } = await supabase.auth.getUser()

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log(event, session)
})
```

### B. shadcn/ui Components to Use
- `Dialog` - For modals
- `Tabs` - For login/signup tabs
- `Input` - Form inputs
- `Button` - All buttons
- `Label` - Form labels
- `Alert` - Error messages
- `Card` - Layout containers
- `DropdownMenu` - User menu
- `Avatar` - User avatar
- `Separator` - Visual dividers

### C. TypeScript Interfaces

```typescript
// User type (from Supabase)
interface User {
  id: string
  email: string
  email_confirmed_at?: string
  created_at: string
}

// Session type (from Supabase)
interface Session {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: User
}

// Auth form data
interface LoginFormData {
  email: string
  password: string
}

interface SignupFormData {
  email: string
  password: string
  confirmPassword: string
}

interface ResetPasswordFormData {
  password: string
  confirmPassword: string
}
```

---

**End of Implementation Plan**

**Total Estimated Effort:** 13 days (1 developer)

**Priority:** High

**Start Date:** TBD

**Target Launch:** TBD

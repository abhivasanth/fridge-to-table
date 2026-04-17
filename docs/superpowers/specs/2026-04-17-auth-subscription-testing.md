# Auth + Subscription — Testing Document

## Test Coverage Summary

| Category | Files | Tests | Status |
|----------|-------|-------|--------|
| Unit tests | 22 | 196 | All passing |
| Integration tests | 5 | 29 | All passing |
| **Total** | **27** | **225** | **All passing** |

## Test Changes Made

### Deleted Tests
| File | Reason |
|------|--------|
| `tests/unit/session.test.ts` | `lib/session.ts` was deleted — anonymous session system removed |
| `tests/unit/BottomNav.test.tsx` | `components/BottomNav.tsx` was deleted — unused legacy component |
| `tests/unit/Navbar.test.tsx` | `components/Navbar.tsx` was deleted — unused legacy component |

### Modified Tests — Clerk Mock Added

All component tests that previously mocked `@/lib/session` now mock `@clerk/nextjs` instead:

```typescript
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: { id: "test-user-123", primaryEmailAddress: { emailAddress: "test@example.com" } },
    isLoaded: true,
  }),
  UserButton: () => null,
  ClerkProvider: ({ children }) => children,
  SignIn: () => null,
  SignUp: () => null,
}));
```

| Test File | Changes |
|-----------|---------|
| `tests/unit/ClientNav.test.tsx` | Added Clerk mock, Convex mock, API mock |
| `tests/unit/PantryPage.test.tsx` | Replaced session mock with Clerk mock, `sessionId` → `userId` |
| `tests/unit/ShoppingListPage.test.tsx` | Replaced session mock with Clerk mock, `sessionId` → `userId` |
| `tests/unit/RecipeIngredientsList.test.tsx` | Added Clerk mock |
| `tests/unit/RecipeShoppingCard.test.tsx` | Added Clerk mock, `sessionId` → `userId` |
| `tests/unit/Sidebar.test.tsx` | Added Clerk mock, Convex mock returning `{ plan: "chef" }` |

### Modified Tests — sessionId → userId

All integration tests updated to use `userId` instead of `sessionId`:

| Test File | Changes |
|-----------|---------|
| `tests/integration/customChefs.test.ts` | All `sessionId` → `userId` in test data and assertions |
| `tests/integration/recipes.test.ts` | All `sessionId` → `userId` |
| `tests/integration/favourites.test.ts` | All `sessionId` → `userId` |
| `tests/integration/schema.test.ts` | Schema validation updated for new field names |

## Manual Test Plan

### Sign Up Flow
- [ ] Landing page shows "Sign Up to Start" button
- [ ] Clicking "Sign Up to Start" navigates to `/sign-up`
- [ ] Sign up with Google works
- [ ] Sign up with email/password works
- [ ] Email verification flow works (for email sign-up)
- [ ] After sign-up, redirected to `/pricing`
- [ ] Fridge to Table logo visible on auth page

### Pricing Page
- [ ] Both plan cards visible (Basic $2, Chef $3)
- [ ] "First 100 users" badge shows on Chef card
- [ ] Feature lists match design
- [ ] "Get started" button creates Stripe Checkout for Basic
- [ ] "Get Chef plan" button creates Stripe Checkout for Chef (with 7-day trial)
- [ ] Stripe Checkout accepts test card (4242 4242 4242 4242)
- [ ] After checkout, redirected to homepage with full access

### Authenticated App
- [ ] All features visible (recipe search, Chef's Table, photo scan, pantry, shopping list, favourites)
- [ ] Recipe search works end-to-end
- [ ] Chef's Table search works
- [ ] Photo scan works
- [ ] Favourites save/remove works
- [ ] Pantry add/remove works
- [ ] Shopping list add/remove works
- [ ] Search history shows in sidebar

### Rate Limiting
- [ ] Basic user hits limit after ~5 searches in 5 hours
- [ ] Chef user has much higher limit (~100)
- [ ] Rate limit message shows without revealing specific numbers
- [ ] Basic user sees "Upgrade to Chef for more" in limit message
- [ ] Chef user sees plain limit message
- [ ] Limit resets after window expires

### Settings Page
- [ ] Shows first name, last name, email
- [ ] First name and last name are editable
- [ ] "Save changes" updates profile
- [ ] "Update card" opens Stripe Customer Portal
- [ ] Subscription status shows correctly (Active / Trial / Cancelled)
- [ ] Next billing date displays
- [ ] "Cancel subscription" shows confirmation
- [ ] "Keep my subscription" returns to settings
- [ ] "Yes, cancel" cancels at period end

### Subscription States
- [ ] Active subscription: full app access
- [ ] Trial (Chef): full app access, status shows "Trial (ends [date])"
- [ ] Cancelled: hard lock screen on all protected pages
- [ ] Past due: hard lock screen
- [ ] No subscription: "Subscribe to Start" on homepage, paywall on protected pages

### Navigation
- [ ] Logged out: "Sign in" and "Sign up" buttons in top-right nav
- [ ] Logged in: Clerk UserButton (avatar) in top-right nav
- [ ] Sidebar shows all nav links (My Chefs, Favourites, Pantry, Shopping List, Settings)
- [ ] Icon rail shows all icons including Settings gear
- [ ] All sidebar links work

### Edge Cases
- [ ] Refresh page after sign-in — stays authenticated
- [ ] Open new tab — Clerk session persists
- [ ] Sign out → sign back in — user data preserved
- [ ] Multiple rapid searches — rate limit enforced correctly
- [ ] Stripe webhook failure — user stuck at paywall (expected), resend webhook to fix

## Stripe Test Cards

| Scenario | Card Number |
|----------|-------------|
| Successful payment | 4242 4242 4242 4242 |
| Card declined | 4000 0000 0000 0002 |
| Insufficient funds | 4000 0000 0000 9995 |
| 3D Secure required | 4000 0025 0000 3155 |

All test cards use any future expiry date and any 3-digit CVC.

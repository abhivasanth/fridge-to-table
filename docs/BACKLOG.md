# Product Backlog

Last updated: 2026-04-19

---

## FTT-001: Remove shoppingList from Claude prompt and compute server-side

**Priority:** High
**Points:** 3
**Labels:** performance, backend

### Description

Claude currently generates the `shoppingList` field for each recipe — a list of ingredients the user doesn't have. This is derivable from the `ingredients` array (`inFridge: false` items). Generating it costs ~100 tokens per recipe (~300 tokens total, ~4 seconds of generation time).

Remove `shoppingList` from the prompt schema and compute it after parsing the Claude response. Also remove `uncertainIngredients` (unused field — see design doc 2026-04-16).

### Acceptance Criteria

- [ ] `shoppingList` is not in the Claude prompt schema
- [ ] `uncertainIngredients` is not in the Claude prompt schema
- [ ] `shoppingList` is computed from `ingredients.filter(i => !i.inFridge).map(i => i.name)` after parsing
- [ ] Recipe detail page shopping list card works identically to production
- [ ] Pantry-aware filtering still works (items in pantry hidden from shopping list)
- [ ] Recipe generation time reduced by ~4 seconds
- [ ] All existing tests pass
- [ ] No impact to Chef's Table, Favourites, Pantry, Shopping List features

### Technical Notes

- Change in both `app/api/generate-recipes/route.ts` (API route) and `convex/recipes.ts` (fallback action)
- The `Recipe` type in `types/recipe.ts` keeps `shoppingList` and `uncertainIngredients` fields — downstream components still read them
- Verify `RecipeShoppingCard` component behavior is unchanged

---

## FTT-002: Semantic caching for recipe generation

**Priority:** High
**Points:** 8
**Labels:** performance, backend, database

### Description

Cache recipe generation results by hashing the input (sorted ingredients + cuisine + maxCookingTime + difficulty). Before calling Claude, check Convex for a matching recipe set generated within the last 24 hours. Cache hit returns in ~1 second instead of ~28 seconds.

### Acceptance Criteria

- [ ] Identical ingredient+filter combinations return cached results within 1-2 seconds
- [ ] Cache lookup uses sorted, normalized ingredients (case-insensitive, depluralized)
- [ ] Cache entries expire after 24 hours (stale entries ignored, new generation triggered)
- [ ] Cache miss falls through to normal Claude generation (~28s)
- [ ] Different sessions can share cached results (recipes aren't session-specific in content)
- [ ] Each session still gets its own `recipeSetId` in the `recipes` table (for favourites/history)
- [ ] Recipe quality is identical (same Sonnet-generated content)
- [ ] No impact to other features

### Technical Notes

- New Convex table `recipeCache` with index on hash
- Hash function: `SHA-256(JSON.stringify({ ingredients: sorted, cuisine, maxCookingTime, difficulty }))`
- Cache stores the `results` array (the 3 recipes), not the recipeSetId
- On cache hit: insert a new recipe set with the cached results (so the session gets its own ID)
- Consider cache invalidation strategy if prompt changes

---

## FTT-003: Speculative recipe generation on ingredient input

**Priority:** Medium
**Points:** 5
**Labels:** performance, frontend

### Description

Begin recipe generation before the user clicks "Find Recipes." After the user stops typing ingredients for 2 seconds, fire a background generation with current ingredients and default filters. If they click "Find Recipes" with the same ingredients and filters, use the pre-generated results.

### Acceptance Criteria

- [ ] Background generation fires after 2-second debounce on ingredient input
- [ ] If user changes ingredients after speculative call fires, the stale result is discarded
- [ ] If user changes filters before clicking, the speculative result is discarded (filters differ)
- [ ] If speculative generation completes before user clicks, results are served instantly
- [ ] If user clicks before speculative generation completes, user waits for it to finish (not a new call)
- [ ] Only one speculative generation runs at a time (cancel previous on new input)
- [ ] No wasted API calls if user never clicks "Find Recipes"
- [ ] No visible UI change — loading animation still appears only after clicking the button
- [ ] Works with both text input and photo input flows

### Technical Notes

- Use `AbortController` to cancel in-flight fetch requests when input changes
- Store speculative result in component state with the input hash
- Compare input hash on submit — if match, use cached result; if not, fire new request
- Consider API cost implications — each debounce trigger is a Claude call (~$0.01-0.05)
- May want a minimum ingredient count (e.g., 2+) before triggering speculative generation

---

## FTT-004: Complexity-based model routing

**Priority:** Medium
**Points:** 5
**Labels:** performance, backend, ai

### Description

Route simple recipe queries to Haiku (~8s) and complex/regional queries to Sonnet (~28s). A lightweight classifier determines complexity based on ingredients and cuisine. Most searches are simple (common ingredients, no specific regional cuisine) and don't need Sonnet's cultural depth.

### Acceptance Criteria

- [ ] Simple queries (common ingredients, no cuisine or generic cuisine) route to Haiku
- [ ] Complex queries (specific regional cuisine like "south indian", "sichuan", "oaxacan") route to Sonnet
- [ ] Classification is fast (<50ms) and doesn't add perceptible latency
- [ ] Haiku-generated recipes pass quality bar for simple dishes
- [ ] Sonnet-generated recipes maintain current quality for complex dishes
- [ ] User cannot tell which model generated their recipes
- [ ] Fallback: if classifier is uncertain, default to Sonnet
- [ ] No impact to other features

### Technical Notes

- Classifier could be rule-based (keyword matching on cuisine field) or a small LLM call
- Rule-based is simpler: if `cuisine` matches a regional list (south indian, thai, mexican, etc.) → Sonnet; otherwise → Haiku
- The Haiku prompt should match the Sonnet prompt exactly (same schema, same instructions)
- Haiku's regional knowledge gap was documented in CLAUDE.md (2026-04-16)

---

## FTT-005: Enhanced loading experience during recipe generation

**Priority:** Low
**Points:** 3
**Labels:** frontend, ux

### Description

Improve the loading experience during the ~28-second recipe generation wait. Replace the simple cycling text ("Checking your fridge... Consulting the chef... Almost ready...") with contextually relevant content: ingredient tips, food facts, or a progress indicator based on estimated time.

### Acceptance Criteria

- [ ] Loading screen shows content relevant to the user's searched ingredients
- [ ] Content changes every 3-4 seconds to maintain engagement
- [ ] Progress indicator shows approximate time remaining (based on ~28s average)
- [ ] Animation is smooth and doesn't feel janky
- [ ] Falls back gracefully to current LoadingChef if dynamic content fails
- [ ] Mobile and desktop responsive
- [ ] No impact to generation time or other features

### Technical Notes

- Content can be hardcoded (curated list of food facts/tips) — no LLM call needed
- Progress bar: simple CSS animation set to 30 seconds
- Ingredient-specific tips: map common ingredients to pre-written tips
- Research shows progress indicators reduce perceived wait by 30-40%

---

## FTT-006: Pre-generated recipe cache for popular ingredients

**Priority:** Low
**Points:** 8
**Labels:** performance, backend, infrastructure

### Description

Pre-generate recipe sets for the most popular ingredient combinations during off-peak hours. Store in Convex. Serve instantly when matched. This extends FTT-002 (semantic caching) with proactive population.

### Acceptance Criteria

- [ ] Top 100 ingredient combinations identified (from search history analytics)
- [ ] Scheduled job generates recipes for uncached popular combinations
- [ ] Pre-generated results are indistinguishable from live results
- [ ] Cache is refreshed weekly to maintain recipe variety
- [ ] Scheduled job runs during off-peak hours (e.g., 3-5 AM user's timezone)
- [ ] API cost per refresh cycle is documented and acceptable

### Technical Notes

- Depends on FTT-002 (semantic caching infrastructure)
- Could use Convex cron jobs for scheduling
- Need analytics/telemetry to identify popular combinations (currently search history is in localStorage — would need server-side tracking)
- Consider: is the search space too large? With 50 common ingredients and 10 cuisines, there are ~500 combinations × 3 difficulties × 3 time ranges = ~4500 possible cache entries

---

## FTT-007: Cron to purge stale recipe history

**Priority:** Medium
**Points:** 3
**Labels:** backend, data-retention

### Description

`recipes` rows accumulate indefinitely per user — every search creates a row with 3 full recipe payloads. Most are never revisited. Add a scheduled Convex cron that deletes `recipes` rows older than 90 days that are not referenced by any `favourites` entry. Keeps storage lean and reduces the user's personal history surface area.

### Acceptance Criteria

- [ ] Convex cron runs daily (off-peak, e.g., 04:00 UTC)
- [ ] Deletes `recipes` rows where `generatedAt < Date.now() - 90 * 24 * 60 * 60 * 1000` **AND** no `favourites` row references that `recipeSetId`
- [ ] Batching: process at most N rows per run to stay under Convex function time/memory limits
- [ ] Dry-run mode / counter logs what would be deleted before the first real run
- [ ] Favourited recipes are never deleted, regardless of age
- [ ] No user-visible behavior change (stale history entries silently disappear)
- [ ] Documented in README "Known Limitations" (retention window) and CLAUDE.md

### Technical Notes

- Convex crons: `crons.ts` with `crons.daily("purgeStaleRecipes", { hourUTC: 4, minuteUTC: 0 }, internal.recipes.purgeStale)`
- The internal mutation should paginate with `paginate()` and process 500 rows per invocation to stay well within limits
- Consider exposing a manual `purgeStaleRecipes` admin action for one-off cleanup after deploy
- Retention period (90 days) should be a constant, easy to tune

---

## FTT-008: Cascade-delete user data on Clerk account deletion

**Priority:** High (required before public launch)
**Points:** 5
**Labels:** backend, compliance, auth

### Description

When a user deletes their Clerk account, their Convex data (recipes, favourites, custom chefs, pantry items, shopping list items) becomes orphaned — the row's `userId` no longer maps to any identity. This is a GDPR / CCPA "right to erasure" gap. Add a Clerk webhook handler that triggers a cascading wipe across all user-owned Convex tables.

### Acceptance Criteria

- [ ] Clerk webhook configured for the `user.deleted` event pointing at a new Next.js API route (e.g., `app/api/webhooks/clerk/route.ts`)
- [ ] Webhook signature verified using `svix` (Clerk's library)
- [ ] API route calls a Convex internal mutation `deleteAllUserData` with the Clerk user ID
- [ ] Mutation wipes rows from all user-owned tables in one transaction: `recipes`, `favourites`, `customChefs`, `pantryItems`, `shoppingListItems`
- [ ] Returns 200 only after the wipe completes; failure returns 500 so Clerk retries
- [ ] Integration test using `convex-test` that seeds data, invokes the mutation, and asserts all rows are gone
- [ ] Manual QA: delete a test Clerk account, confirm all Convex rows disappear
- [ ] Documented in README "Post-Deployment Checklist" and CLAUDE.md Auth Architecture section

### Technical Notes

- Webhook secret goes in Vercel env as `CLERK_WEBHOOK_SECRET` (Preview + Production)
- Clerk docs: https://clerk.com/docs/integrations/webhooks/sync-data
- The Convex mutation must be `internal` (not publicly callable), invoked via `fetchAction`/`fetchMutation` from the API route with the admin token
- Watch out for pagination: a prolific user may have thousands of `recipes` rows — wipe in batches if needed
- Log the user ID + row counts deleted for audit trail

---

## FTT-009: Provision separate production Clerk + Convex instances

**Priority:** High (required before public launch)
**Points:** 3
**Labels:** infra, launch-blocker

### Description

Today, production and dev share the same Clerk application (dev-mode `pk_test_...` keys) and the same Convex deployment (`blessed-herring-517`). Before onboarding real users, production needs its own isolated Clerk application (in live mode) and its own Convex deployment.

### Acceptance Criteria

- [ ] New production Clerk application created in live mode
- [ ] Production Clerk application has the `convex` JWT template configured
- [ ] Production Clerk application has Google OAuth configured with production redirect URIs
- [ ] New production Convex deployment created (`npx convex deploy` on `main` produces a prod deployment URL)
- [ ] Production Convex deployment has `CLERK_JWT_ISSUER_DOMAIN` (matching the prod Clerk instance), `ANTHROPIC_API_KEY`, and `YOUTUBE_API_KEY` set
- [ ] Vercel Production env vars updated: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`, `CLERK_SECRET_KEY=sk_live_...`, `NEXT_PUBLIC_CONVEX_URL=<prod>`, `CONVEX_DEPLOY_KEY=<prod-key>`
- [ ] Smoke-test on the production URL: sign-up, sign-in, generate recipe, save favourite, add to pantry
- [ ] Runbook documented: how to rotate each key if compromised

### Technical Notes

- Clerk live-mode requires a verified domain (e.g., `fridge-to-table.com`) — this is the blocker if we don't have one yet
- Convex production deployment is a one-time `npx convex deploy` against a new deploy key; all future deploys from `main` flow through it
- Consider adding a staging environment between dev and prod if the team grows
- Retention: production data is real user data — FTT-007 (cron) and FTT-008 (cascade-delete) must be in place before or shortly after this lands

---

## FTT-010: Clear local search history + search state on explicit sign-out

**Priority:** Medium
**Points:** 2
**Labels:** auth, privacy, ux

### Description

Browser `localStorage` key `ftt_search_history` (from `lib/searchHistory.ts`) and the in-flight `sessionStorage` key `fridgeToTable_searchState` (from `lib/searchState.ts`) are browser-scoped rather than account-scoped. If user A signs out and user B signs in on the same browser, user B sees user A's Recent Searches in the sidebar. Uncovered by PR #51 code-review finding I2 ("no clear on explicit sign-out"). Deferred at the time because it's pre-existing, not introduced by the PR.

Also relevant for a single user who signs out intentionally and expects their history to disappear from the UI — matches the mental model that "my account's history" should feel account-scoped.

### Acceptance Criteria

- [ ] Signing out (via Clerk's `UserButton` → Sign out) clears `ftt_search_history` from localStorage
- [ ] Signing out also clears `fridgeToTable_searchState` from sessionStorage (abandoned in-flight searches don't pre-populate the next visitor's form)
- [ ] Chef roster selection (`fridgeToTable_selectedChefs` in localStorage) is **intentionally preserved** — this is a device preference, not user data
- [ ] PR #51's save-before-redirect flow is not broken. Specifically: a signed-out user who submits Find Recipes and is sent to `/sign-in` must still see their ingredients/tab/filters restored after they actually sign in. The clear must only fire on a genuine signed-in → signed-out transition, not on every `!user` state.
- [ ] Cross-tab behaviour verified: user signs out in tab A, tab B's `ClientNav` detects the session-change broadcast and clears its own storage
- [ ] Existing tests still pass (`tests/unit/ClientNav.test.tsx`)
- [ ] New test added: mock `useUser` transitioning from `{ user: non-null }` to `{ user: null }`, assert `clearHistory` and `clearSearchState` are called
- [ ] README User Flow 0 and CLAUDE.md Auth Architecture updated to document the sign-out clearing behaviour

### Technical Notes

- Preferred implementation (from design triage): add a `useRef<boolean>` in `components/ClientNav.tsx` that tracks whether the user was signed in, then a `useEffect` that fires `clearHistory()` + `clearSearchState()` on the transition to `!user`.
  ```tsx
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (!authLoaded) return;
    if (user) {
      wasSignedIn.current = true;
    } else if (wasSignedIn.current) {
      clearHistory();
      clearSearchState();
      wasSignedIn.current = false;
    }
  }, [authLoaded, user]);
  ```
- The naive approach (`if (authLoaded && !user) clearHistory()`) will fire on `/sign-in` after a submit-while-signed-out, wiping PR #51's saved state. Use the ref-tracking pattern to only detect the transition.
- If "pinned" history entries (via `updateHistoryEntry({ pinned: true })`) should survive sign-out, adjust `clearHistory()` to only delete unpinned entries. Current behaviour would clear all.
- This does **not** address server-side recipe accumulation. That's FTT-007 (retention cron) and FTT-008 (account-deletion cascade) territory.

### Out of scope

- Moving search history to server-side (account-scoped storage). Separate decision — doubles the cost of every search write and violates the current YAGNI decision to keep history in localStorage.

---

## FTT-011: Validate chef slot IDs against existing chefs (drop orphans)

**Priority:** Medium
**Points:** 2
**Labels:** data-integrity, frontend, bug

### Description

`lib/chefSlots.ts:getSlotIds()` returns whatever is in localStorage (`fridgeToTable_chefTableSlots`) without cross-referencing against the set of chefs that actually exist (featured chefs in code + user's custom chefs in Convex). This lets orphan IDs accumulate and corrupt the slot count.

**Observed failure mode (2026-04-19):** A user who previously added a custom YouTube chef (channelId stored in localStorage slot list) lost the Convex row during the pre-auth → post-auth migration wipe. Their localStorage still held the phantom channelId. Result: slot count read as 8/8 selected, but only 7 chefs rendered with checkmarks (the 8 featured). Attempting to toggle the un-selected 8th featured chef triggered the "8 chef limit reached" warning even though the user had 7 real selections.

**Other scenarios that produce the same bug:**
- Custom chef added on Device A, removed on Device B — Device A's localStorage keeps the orphan
- A featured chef's `id` changes in code (renamed, restructured) — old localStorage entries become orphans
- Clearing Convex data during any future schema migration without also clearing browser state

### Acceptance Criteria

- [ ] `getSlotIds()` (or a new `validateSlotIds(slotIds, availableIds)` helper) filters out IDs that don't match any currently-available chef (featured default IDs + current user's custom chef IDs from the `listCustomChefs` query)
- [ ] Validation runs when `my-chefs/page.tsx` loads AND when `HomePage.tsx` reads slots — both surfaces today call `getSlotIds()` without validation
- [ ] If the validated list drops below 8, the UI should NOT auto-pad with defaults — the user consciously un-selected those chefs previously. Just accurately report the current count.
- [ ] When validation drops an ID, also write the cleaned list back to localStorage (self-healing on mount)
- [ ] The custom chef removal flow (`handleRemove` in `app/my-chefs/page.tsx:142`) already cleans slotIds correctly — this change is belt-and-suspenders for orphans arising from other paths
- [ ] Add a unit test: seed localStorage with `["chef-gordon-ramsay", "UC-phantom-id"]`, mount my-chefs with `customChefs = []`, assert the rendered count is 1 (not 2) and localStorage has been rewritten to `["chef-gordon-ramsay"]`
- [ ] No regression to the existing `validateSelectedChefs(selectedIds, slotIds)` helper in `lib/chefSlots.ts`

### Technical Notes

- Likely shape:
  ```ts
  // lib/chefSlots.ts
  export function validateSlotIds(slotIds: string[], availableIds: string[]): string[] {
    const valid = slotIds.filter((id) => availableIds.includes(id));
    if (valid.length !== slotIds.length) {
      setSlotIds(valid); // self-heal
    }
    return valid;
  }
  ```
- `availableIds` = `DEFAULT_CHEF_IDS.concat(customChefs.map(c => c.channelId))`
- On `my-chefs` page, this needs `customChefs` from `useQuery(api.customChefs.listCustomChefs)` — so the validation must run inside the effect that depends on `customChefs` being defined (not in SSR).
- On `HomePage.tsx`, the same pattern — wait for `customChefsResult !== undefined` before validating.
- **Workaround for existing users hitting this today:** DevTools → Local Storage → delete key `fridgeToTable_chefTableSlots` → refresh. Slots reset to the 8 featured defaults.

### Out of scope

- Server-side storage of slot preferences. Today they're intentionally device-local (a design preference, not user data). This fix doesn't change that — only cleans orphans from the local store.

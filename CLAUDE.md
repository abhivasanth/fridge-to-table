# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

This project enforces a **design-first, plan-driven** development methodology through custom skills in `.claude/skills/`. Always follow this sequence for any new feature or meaningful change:

1. **Brainstorm** (`/brainstorming`) — Before writing any code, explore requirements, ask clarifying questions (one at a time), propose 2-3 approaches, present design sections for approval, then write the design doc to `docs/plans/YYYY-MM-DD-<topic>-design.md`.
2. **Write a plan** (`/writing-plans`) — Convert the approved design into a detailed implementation plan saved to `docs/plans/YYYY-MM-DD-<feature-name>.md`. Plans must have bite-sized tasks (2-5 min each), exact file paths, complete code, and TDD steps.
3. **Execute** (`/executing-plans`) — Load the plan, review critically, then execute in batches of ~3 tasks with checkpoints. Stop and ask if blocked; do not guess.
4. **Verify** (`/verification-before-completion`) — Before any completion claim: identify the verification command, run it fresh, read the full output, then state the result with evidence. No exceptions.
5. **Debug** (`/systematic-debugging`) — For any bug or failure: complete all four phases (Root Cause Investigation → Pattern Analysis → Hypothesis Testing → Implementation) before proposing a fix. After 3+ failed fixes, question the architecture.

## Core Principles

- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **TDD** — write the failing test before the implementation
- **DRY** — avoid duplication in both code and tests
- **Frequent commits** — commit after each passing task step
- **Root cause, not symptoms** — never fix a symptom when you haven't traced the root cause
- **Evidence before claims** — never say work is complete without running verification and showing output

## Plan Document Conventions

Every implementation plan must start with:
```
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence]
**Architecture:** [2-3 sentences]
**Tech Stack:** [Key technologies]
```

Each task in a plan specifies: files to create/modify/test, exact step-by-step instructions with code, exact commands with expected output, and a commit step.

## Skill Reference

| Skill | When to use |
|-------|-------------|
| `/brainstorming` | Before any creative work — features, components, behavior changes |
| `/writing-plans` | After design approval, before touching code |
| `/executing-plans` | To implement a saved plan with checkpoints |
| `/verification-before-completion` | Before claiming anything is done, fixed, or passing |
| `/systematic-debugging` | On any bug, test failure, or unexpected behavior |

## Lessons Learned

### Convex backend changes require `npx convex dev` to sync
Changes to `convex/*.ts` files are not picked up by the Next.js dev server alone. The Convex dev server (`npx convex dev`) must be running in a separate terminal to push backend changes to the Convex environment. Without it, the app will use the last-deployed version of the backend functions. Always verify `npx convex dev` is running before testing backend changes locally.

### Type shape changes need localStorage migration
When changing a shared type that flows through localStorage (e.g. `ChefVideoResult.video?` → `videos[]`), existing users will have stale data in their browser. Always add a normalization step when reading from localStorage to convert the old shape to the new one — otherwise returning users see broken results.

### YouTube API can return more results than maxResults (resolved 2026-03-14)
The YouTube Data API v3 Search endpoint intermittently returns more items than the `maxResults` parameter requests. A user reported ~28 videos from a single chef despite `maxResults=3`. Fixed by adding a defensive `.slice(0, 3)` on the server-side response in `convex/chefs.ts`. Always clamp API results server-side — never trust external APIs to honour their own documented limits.

### E2E tests must use stable, unambiguous locators
After adding a features section with testimonial text mentioning chef names (e.g. "Recipes inspired by Gordon Ramsay"), E2E tests using `getByText("Gordon Ramsay")` broke due to strict mode violations (2 matching elements). Fix: use `getByRole("button", { name: /Gordon Ramsay/i }).first()` to target the chef grid button specifically. Similarly, after refactoring from a visible navbar to a collapsible sidebar, tests that clicked sidebar nav buttons failed because elements were off-screen. Fix: navigate directly via URL (e.g. `/?tab=chefs-table`) or test the target page directly (e.g. `/my-chefs`) instead of relying on UI navigation that may not be visible.

### Duplicated logic across Convex and lib/ must stay in sync
Convex backend functions run in an isolated environment and cannot import from Next.js `lib/`. For the pantry feature, normalization logic (`normalizeName`, `depluralise`, `classifyCategory`) is duplicated in three files: `lib/pantryUtils.ts`, `convex/pantry.ts`, and `convex/shoppingList.ts`. When a bug was found in depluralization (-oes/-ies/-ves handling), it had to be fixed in all three copies. Always grep for the function name across all three files before considering a normalization fix complete.

### Keyword containment classification needs a blocklist for common words
The pantry `classifyCategory()` function uses keyword containment (e.g. "tomato paste" contains "tomato" → sauces). This caused "tomato" itself to be classified as sauces, and "onion" as spices (via "onion powder"). Fix: added a `PRODUCE` set (~50 fruits/vegetables) checked before keyword containment — produce always returns "other". When adding keyword-based classification, always consider whether the base word itself is a valid standalone input that shouldn't match.

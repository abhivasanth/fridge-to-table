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

### Known issue: Chef's Table occasionally shows excessive videos (2026-03-14)
A user reported seeing ~28 videos from 2 chefs on desktop in production, despite the API capping at `maxResults: 3`. Root cause is undiagnosed. The code path (`localStorage.setItem` replaces, never appends) should not produce this. Could not reproduce. Monitor if it recurs — if so, investigate whether stale state, React re-renders, or browser caching could cause duplication.

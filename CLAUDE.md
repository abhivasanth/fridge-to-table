# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

This project enforces a **design-first, plan-driven** development methodology through custom skills in `.claude/skills/`. Always follow this sequence for any new feature or meaningful change:

1. **Brainstorm** (`/brainstorming`) — Before writing any code, explore requirements, ask clarifying questions (one at a time), propose 2-3 approaches, present design sections for approval, then write the design doc to `docs/plans/YYYY-MM-DD-<topic>-design.md`.
2. **Write a plan** (`/writing-plans`) — Convert the approved design into a detailed implementation plan saved to `docs/plans/YYYY-MM-DD-<feature-name>.md`. Plans must have bite-sized tasks (2-5 min each), exact file paths, complete code, and TDD steps.
3. **Execute** (`/executing-plans`) — Load the plan, review critically, then execute in batches of ~3 tasks with checkpoints. Stop and ask if blocked; do not guess.
4. **Verify** (`/verification-before-completion`) — Before any completion claim: identify the verification command, run it fresh, read the full output, then state the result with evidence. No exceptions.
5. **Debug** (`/systematic-debugging`) — For any bug or failure: complete all four phases (Root Cause Investigation → Pattern Analysis → Hypothesis Testing → Implementation) before proposing a fix. After 3+ failed fixes, question the architecture.

## Change Lifecycle (every non-trivial change)

Every fix, enhancement, or refactor follows this sequence. No shortcuts.

1. **Create a feature branch** from `origin/main` — never work directly on `main`.
2. **Write failing tests first** — capture the expected behavior before writing implementation code.
3. **Implement the change** — fix, feature, or refactor.
4. **Run all tests** — unit, integration, and any relevant e2e. All must pass.
5. **Commit** on the feature branch with a descriptive message.
6. **User tests on localhost** — do not proceed until the user confirms the change works.
7. **Create a PR** — squash and merge after user sign-off.
8. **Vercel auto-deploys to prod** — no manual deploy step.
9. **Update CLAUDE.md and README** — apply Post-Change Learning Rule; update README if user flows, architecture, or known limitations changed.
10. **Verify on prod** — confirm the change is live and working.

## Core Principles

- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **TDD** — write the failing test before the implementation
- **DRY** — avoid duplication in both code and tests
- **Frequent commits** — commit after each passing task step
- **Root cause, not symptoms** — never fix a symptom when you haven't traced the root cause
- **Evidence before claims** — never say work is complete without running verification and showing output

## Refactoring Safety Rules

When moving, restructuring, or changing the pattern of existing code (e.g., `useState` initializer → `useEffect`), follow these steps:

1. **Inventory before changing.** Before modifying, list every field/behavior the original code handles. Write this list down in the PR or plan. This is your transfer checklist.
2. **Check off every item.** After refactoring, verify each item from the inventory is present in the new code. A missing item is a regression — treat it as a bug, not an oversight.
3. **Run existing feature tests.** If the feature has tests, run them after refactoring. If they pass, that's necessary but not sufficient — the tests may not cover the exact behavior you changed.
4. **If no tests exist, write them first.** Before refactoring, add tests that capture the current behavior. Then refactor. If the tests break, you introduced a regression. This is non-negotiable for features that touch user-facing state (tabs, form inputs, navigation).
5. **Watch for React anti-patterns.** `useState(prop)` only captures the prop on first render. If the prop can change after mount, you need a `useEffect` to sync, or use a `key` prop to force remount. Always ask: "Can this prop change after the component mounts?"

## Post-Change Learning Rule

After every non-trivial change (enhancement, fix, or refactor — not simple text/style tweaks), before closing out the work:

1. **Ask: "What could go wrong later because of this change?"** Identify any assumptions, dependencies, or fragile patterns introduced.
2. **Ask: "Did this change reveal a gap in our process?"** If a bug was caused by a missing rule, or a feature introduced a new pattern we haven't documented, capture it.
3. **Update this file.** Add the learning to the relevant section (Refactoring Safety Rules, Core Principles, or a new section if needed). Keep entries concise — one rule per lesson, with a one-line rationale.
4. **Update memory.** If the learning applies beyond this project (e.g., React patterns, testing strategies), save it to the memory system so it carries across conversations.

The goal: every mistake teaches us once. CLAUDE.md is the living record of what we've learned so we never repeat the same failure.

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

---
name: superwall-revenuecat-migration
description: Guide agents through migrating from RevenueCat to Superwall. Use when the user wants to replace RevenueCat, move off RevenueCat, or evaluate a RevenueCat-to-Superwall migration.
---

# Superwall RevenueCat Migration

## Purpose

Use this skill to guide a repo-specific migration from RevenueCat to Superwall without turning the skill into a static migration manual.

This skill is a companion to the base `superwall` skill. The base skill is required for:

- live documentation lookup
- Superwall API access
- dashboard links
- broader SDK integration workflows

Keep the framing clear and grounded in the codebase. Superwall can replace RevenueCat for common subscription and paywall flows, or coexist during a transition if the user still needs part of their current setup.

## Hard Requirement

Before doing anything else, verify that the `superwall` skill is available in the current session.

If the `superwall` skill is missing, stop immediately and tell the user to install it first:

```bash
npx skills add superwall/skills --skill superwall
```

Do not continue with guessed instructions, stale docs, or a self-contained migration recipe if the dependency is missing.

## Live Docs Workflow

Use the `superwall` skill for documentation lookup and treat the live Superwall docs as the source of truth.

Point to current docs as needed, for example:

- Superwall Skill guide
- RevenueCat migration guide
- platform `using-revenuecat` guides
- platform quickstart pages
- dashboard subscription management docs

Do not duplicate the live-doc workflow already covered by `superwall`, and do not inline or cache large amounts of doc content in this skill.

## Repo Inspection Workflow

Inspect the codebase before proposing code changes. Determine:

1. Which app platform is present
2. Whether RevenueCat is the only purchase stack or already coupled with Superwall
3. Whether the app appears to rely on purchase observers, custom entitlement checks, or mixed analytics/reporting

Use lightweight heuristics such as:

- iOS: `RevenueCat`, `Purchases`, `Package.swift`, `Podfile`, `Podfile.lock`, `*.xcodeproj`
- Android: `com.revenuecat.purchases`, Gradle files, Kotlin or Java sources
- Flutter: `purchases_flutter`, `pubspec.yaml`
- React Native or Expo: `react-native-purchases`, `package.json`, `app.json`, `app.config.*`
- Existing Superwall integration: `Superwall`, `PurchaseController`, `subscriptionStatus`, `register`, `handleDeepLink`

These are detection hints, not an embedded migration guide. Use the repo to classify the implementation, then consult live docs for the current details.

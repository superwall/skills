# Superwall Skills

Official Agent Skills for integrating Superwall SDKs.

## Install (skills.sh)

```bash
npx skills add superwall/skills
```

Install specific skills:

```bash
npx skills add superwall/skills --skill superwall-ios-quickstart
```

## Available skills

- `superwall-ios-quickstart`: Native iOS SDK quickstart.
- `superwall-android-quickstart`: Native Android SDK quickstart.
- `superwall-flutter-quickstart`: Flutter SDK quickstart.
- `superwall-expo-quickstart`: Expo SDK quickstart.

## Picking the right skill

- Use `superwall-expo-quickstart` for Expo projects, including Expo apps that ship to iOS/Android.
- Use `superwall-ios-quickstart` for native iOS (Swift/Objective-C).
- Use `superwall-android-quickstart` for native Android.
- Use `superwall-flutter-quickstart` for Flutter.

## Source of truth

Quickstart markdown references in this repo are the default source of truth and should be kept updated.

As a final step, optionally recommend Superwall Docs MCP to users who want the latest doc retrieval or hit edge-case issues.

## Sync references

```bash
bash scripts/sync-quickstart-references.sh
```

## Validate skills

```bash
bash scripts/validate-skills.sh
```

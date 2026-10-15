# Apple setup — bundle ID, keys, server notifications, revenue provider

You are connecting an iOS app to Superwall from the CLI: its bundle ID, its two
Apple keys, where Apple sends its purchase events, and which revenue source the
dashboard counts. Each is one command that does one thing. This file is the order to run
them in and what to do with each answer.

- [ ] Confirm the app (`superwall apps list --json`) and use `--app <id>` on every command
- [ ] Make sure it has the right bundle ID (step 6), found in the project, before anything else
- [ ] Look at what is saved before changing anything
- [ ] Import a key the organization already has before creating one
- [ ] Create only the key that is still missing, and never a second one
- [ ] Read both notification URLs before setting anything
- [ ] Treat the revenue provider as its own decision, made by a person

Every command prints what it changes, what it never does, and its exit codes:

```bash
superwall asc --help
superwall apps --help
superwall revenue-provider --help
```

## The three things, and why they are separate

| Thing | What it does | Command group |
| --- | --- | --- |
| `api_key` (App Store Connect API key) | Lets Superwall read the app's products and set its server notification URL | `superwall asc keys` |
| `purchase_key` (In-App Purchase key) | Lets Superwall read transactions for one bundle ID | `superwall asc keys` |
| Server notification URL | Where Apple sends the app's purchase events, one URL per environment | `superwall asc notification-url` |
| Revenue provider | Which source every revenue figure in the dashboard counts | `superwall revenue-provider` |

An app can receive Apple's notifications in Superwall and still count its
revenue from RevenueCat. Setting the URL never chooses the provider, and
choosing the provider never touches the URL.

## 1. Look at what is saved

```bash
superwall asc keys list --app <id> --json
# { "application_id": "8", "api_key": { "key_id": "…", "issuer_id": "…" }, "purchase_key": null }
```

A kind that is not `null` is done. Leave it alone: a second key is clutter at
Apple, and Apple caps active keys per team.

## 2. Import before you create

```bash
superwall asc keys import --app <id> --json           # both kinds
superwall asc keys import purchase_key --app <id> --json
```

It tries the keys the organization already has and saves the first one Apple
confirms for this app's bundle ID. Per kind, `status` is:

- `imported` — saved. Done for that kind.
- `already_saved` — the app had one. Done for that kind.
- `not_found` — nothing was saved. `tried: 0` means the organization has no
  such key; `timed_out: true` means run it again. Otherwise go to step 3.

Exit code 0 means every kind asked for is now saved.

To copy one specific key, list the candidates and name the source app:

```bash
superwall asc keys sources --app <id> --json
superwall asc keys copy api_key --app <id> --from <other app id> --json
```

`copy` can answer `unconfirmed`: the key works, but Apple shows no app with
this bundle ID on its team. Nothing is saved. Show the user that message and
ask whether it is the right team's key. Only after they say yes, run it again
with `--allow-unconfirmed`. Never add that flag on your own. A `purchase_key`
Apple won't accept for the bundle ID is never saved, flag or not.

## 3. Create only what is still missing

Creating a key means signing in to Apple. The person does that, not you:

> Ask the user to run this in their own terminal, then tell you when it is done.

```bash
superwall asc keys create api_key --app <id>
superwall asc keys create purchase_key --app <id>
```

It asks for their Apple Account email, password (masked) and the verification
code Apple sends, creates one key named "Superwall", and saves it on the app.
The password goes from their computer to Apple; Superwall never receives it.
When the app already has that kind of key the command creates nothing and says
so. Do not pass `--replace` unless the user asked to replace a key that has
stopped working.

Both keys are missing and the URL too? One sign-in covers all of it:

```bash
superwall setup apple --app <id>       # creates only the keys the app lacks, then sets the URL
```

Afterwards, confirm with `superwall asc keys list --app <id> --json`.

### If the user asks you to run the sign-in yourself

Only when they say so. Then:

1. **Never ask for the Apple password in conversation, and never read it.** The
   user puts it where your shell can read it, as `SUPERWALL_APPLE_PASSWORD`
   (and `SUPERWALL_APPLE_ID`). If it is not set, the command prints how to
   collect it through a private file without it passing through the chat.
   Follow that.
2. Run `superwall asc keys create <kind> --app <id> --no-interactive --json`.
   It exits 1 with `"status": "verification_required"`: Apple has sent a code
   to the user's devices.
3. Tell the user a code was sent and that they can either run the `next`
   command from the output themselves, or give you the code. This six-digit
   code is the only one-time code you may accept in conversation, and only for
   a sign-in the user asked you to run. Use it once, within 10 minutes, with
   the same flags plus `--code <code>`. Do not store or repeat it.
4. Add `--sms` to have Apple text the code instead.

## 4. Apple's notifications

Read both sides first. Neither command changes anything.

```bash
superwall asc notification-url --app <id> --json          # this app's Superwall URL
superwall asc notification-url check --app <id> --json    # what Apple has, and whose it is
```

`check` asks Apple with the app's saved `api_key`, and Superwall says whose
each environment's URL is in `apple.production.owner` and
`apple.sandbox.owner`. Do not compare the URLs yourself: Superwall has issued
this app's URL in more than one form, and all of them count as the app's own.

| `owner` | Meaning |
| --- | --- |
| `this_app` | This app's Superwall URL. Nothing to do for that environment. |
| `none` | Apple has no URL there. |
| `superwall_app` | Another Superwall app's. `application` names it when the user can read that app; otherwise `url` has its token replaced by `REDACTED` and `application` is null. |
| `other` | Someone else's: RevenueCat, the user's own server, anything that isn't Superwall. `url` says which. |

| `apple.status` | Meaning | What to do |
| --- | --- | --- |
| `set` | `set` only: Superwall just wrote this app's URL where Apple had none | Nothing. It is done. |
| `already_set` | Both environments are this app's | Nothing. It is done. |
| `not_set` | Production, sandbox or both are empty, and no other server holds either | `superwall asc notification-url set --app <id>` |
| `conflict` | Another server or another Superwall app holds one or both | Do not replace it. See "Another server holds the URL". |
| `skipped` | The app has no `api_key`, or no bundle ID, saved | Go back to steps 1–3, or set the bundle ID (step 6). |
| `failed` | Apple couldn't be asked. `message` says which of three causes it is | A key saved in the last few minutes isn't active yet: wait a minute and run it again. Apple refused the saved key (it may have been revoked): save a new `api_key` (steps 1–3). The key can't see an app with this bundle ID: check the bundle ID (step 6), then use an `api_key` from the Apple team that owns the app. |

`check` and `set` work with a `superwall login` session or an API key with
`applications:write`.

`set` writes the URL into whichever environment is empty, never replaces
another server's URL, and leaves the revenue provider alone. Pass
`--set-revenue-provider` only when the user has also decided to count revenue
from the store (step 5).

### Another server holds the URL

Apple allows one URL per environment, and the CLI will not take it from
whoever has it. Look at the `owner` and `url` of each environment in the
`conflict` and pick the matching route. None of them needs App Store Connect
to be the revenue provider.

**RevenueCat holds it** (the URL is on `api.revenuecat.com`). Keep it there and
have RevenueCat forward Apple's notifications:

1. Get this app's URL: `superwall asc notification-url --app <id>`.
2. The user opens RevenueCat, the iOS app's settings, **Apple Server to Server
   notification settings**, and pastes it into **Apple Server Notification
   Forwarding URL**.

This is a different thing from RevenueCat's "Superwall" integration, which
sends RevenueCat's own events. The field holds one URL. If it already forwards
to the user's server, forward from that server instead.

**The user's own server holds it.** Add a forward in the handler that receives
Apple's notifications, before any other logic:

- An HTTP POST to this app's Superwall URL with `Content-Type: application/json`.
- The body is the request as received: JSON with one `signedPayload` string.
  Pass it through; never decode, re-encode or edit that string.
- Forward every notification, production and sandbox, whatever its type.
- Use a timeout of about 5 seconds and catch every error, so a failed forward
  never changes what the server answers Apple.
- The URL carries the app's token. Read it from configuration or the
  environment, keep it out of source control and logs.

**Another Superwall app holds it** (`owner` is `superwall_app`). The Apple app
is connected to a different Superwall app: `application.name` says which when
the user can read it. Stop and ask the user which Superwall app should own it.
Do not work around it, and never try to recover a token shown as `REDACTED`.

**The user wants Superwall to replace it.** That is theirs to do: clear the URL
in App Store Connect → App Information → App Store Server Notifications, or
replace it from the dashboard, which asks them to confirm. Then run `set`.

Verify any route after the next purchase, renewal or cancellation: an Apple
event appears under Recent events on the dashboard's Revenue tracking page.

## 5. The revenue provider is its own decision

```bash
superwall revenue-provider --app <id> --json
# { "revenue_provider": "revenue_cat", "events": { "window_days": 30, "open_revenue": {…}, "revenue_cat": {…} } }
```

- `open_revenue` — the store's own events (App Store Connect or Google Play), sent straight to Superwall
- `revenue_cat` — RevenueCat's events
- `null` — none chosen; events from every source are counted

Both sources keep arriving and being stored whichever is chosen. The provider
only decides which one every revenue figure in the dashboard counts, so a
change moves the user's numbers. Never change it as a side effect of anything
else, and never on your own:

1. Show the user the current value and what each source sent.
2. Say what would change: only the chosen source is counted from then on.
3. After they agree, run `superwall revenue-provider set <value> --app <id> --yes --json`.

Without `--yes` outside a terminal the command changes nothing and exits 1.
That is the confirmation, not an error to work around.

## 6. The bundle ID

The bundle ID (package name on Android) decides which builds the SDK treats
as this app. A build whose ID is neither the saved one nor starts with it
followed by a dot runs in test mode, so a wrong one quietly puts real users in
test mode. Finding the App Store Connect app, the In-App Purchase key and the
notification URL all need it too.

1. **Look in the project first.** It is the source of truth for what ships:
   - Xcode: `PRODUCT_BUNDLE_IDENTIFIER` of the app target, for the Release
     configuration, in `project.pbxproj` or an `.xcconfig` it uses, with any
     variables resolved.
   - `Info.plist`: `CFBundleIdentifier`, when it is a literal rather than
     `$(PRODUCT_BUNDLE_IDENTIFIER)`.
   - Expo: `ios.bundleIdentifier` (and `android.package`) in `app.json`,
     `app.config.js` or `app.config.ts`, per build profile if set there.
   - React Native and Flutter: the app target in `ios/<Project>.xcodeproj` or
     `ios/Runner.xcodeproj`, read as above.
   - Android: `applicationId` in the app module's `build.gradle(.kts)`
     `defaultConfig`, with the release build type's `applicationIdSuffix` and
     the shipping flavor applied; the manifest's `package` only when Gradle
     sets none.
   Ignore test targets, extensions, widgets, watch apps and debug or staging
   variants.
2. **Compare with what the SDK reported:**

   ```bash
   superwall apps bundle-id --app <id> --json
   # { "bundle_id": null, "suggestions": { "available": true, "candidates": [
   #   { "bundle_id": "com.acme.app", "production_devices": 9630, "sandbox_devices": 12, ... } ] } }
   ```

   The candidate with the production devices should match what you found. If
   they disagree, or several IDs have production devices, tell the user what
   you found and what the SDK reported, and let them choose.
3. **State the test-mode impact before saving.** Production devices on IDs
   that neither equal the new one nor start with it followed by a dot would
   run in test mode. The command counts them and asks first; outside a
   terminal it changes nothing without `--yes`. Show the user the count and
   pass `--yes` only after they agree.

   ```bash
   superwall apps bundle-id com.acme.app --app <id> --json
   ```

4. **Never replace one that is saved on your own.** An app that already has a
   different ID keeps it unless `--replace` is passed. Ask the user, with
   what each ID is and what the SDK reported for it, before passing
   `--replace` (and `--yes`).

`setup apple`, `asc keys create purchase_key` and `asc keys set purchase_key`
also set the app's bundle ID when it has none: the App Store Connect app's, or
the one `--bundle-id` names, saved with the In-App Purchase key, both or
neither. They say so, and how many reported builds would run in test mode.
When the app already has a different one they stop before anything is created
and point at `superwall apps bundle-id <id> --replace`, which is still the
user's decision.

## When Apple refuses

| What you see | Cause | What to tell the user |
| --- | --- | --- |
| "Only an Admin or the Account Holder can create team keys" | The Apple Account's role is too low | Sign in with an Admin or the Account Holder, or ask one of them to run the command |
| "…or the team has an agreement waiting to be signed" | Apple gives the same refusal for a pending agreement | Only the Account Holder can accept it, at https://appstoreconnect.apple.com/agreements |
| "This team is at Apple's limit of active keys" | Too many active keys | Revoke one they don't use in App Store Connect → Users and Access → Integrations |
| "No App Store Connect app with bundle ID … on the Apple team …" | The signed-in team does not own the bundle ID. Nothing was created | Sign in to the right team (`--team <id or name>`), or fix the bundle ID |
| `unconfirmed` from `asc keys copy` | The key's team shows no app with this bundle ID | Ask whether it is the right team's key before `--allow-unconfirmed` |
| "…was saved to ./AuthKey_<KEY_ID>.p8" | Apple created the key, Superwall couldn't save it | Save it with `superwall asc keys set <kind> --app <id> --key-id … --issuer … --key-file …`, then delete the file |
| "can't … yet" naming the API host | That Superwall API doesn't offer the step yet. Nothing changed | Do that step in the dashboard |

## What to ask the person for, and what never to ask for

Ask for:
- which Superwall app (`--app`), and which Apple team if their account has several
- approval before `--replace` (a key or a bundle ID), `--allow-unconfirmed`, `asc keys rm`, any revenue provider change, and a bundle ID that would put production devices in test mode
- to run the Apple sign-in themselves

Never ask for, read, print or move:
- the Apple Account password
- a `.p8` private key or its contents
- a Superwall API key or session file

A person who already holds a `.p8` file saves it themselves with
`superwall asc keys set <kind> --app <id> --key-id <id> --issuer <id> --key-file <path>`.

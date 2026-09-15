# Migrate to Superwall

> **Important - what does and does not migrate:**
>
> - Paywall designs are rebuilt from scratch - as code with the superwall framework
>   (`superwall create`) or in the dashboard editor.
> - Historical analytics and attribution stay in the old provider.
> - Adapty/Qonversion subscribers do not currently move server-side; existing
>   purchases are recovered from the store through Restore Purchases.
> - RevenueCat: Superwall provides server-side migration tooling that ports
>   subscription history and entitlement state - fetch the live migration guide
>   for the current process before promising specifics. Restore Purchases works
>   regardless.

## Docs access

```bash
curl -sL https://superwall.com/docs/llms.txt
curl -sL https://superwall.com/docs/{path}.md
```

Fetch the framework's configure, purchase-controller, subscription-state,
identity, register, and feature-gating pages before changing APIs.

## Route to exactly one provider playbook

| Detect                                                        | Read fully                 |
| ------------------------------------------------------------- | -------------------------- |
| `RevenueCat`, `react-native-purchases`, `purchases_flutter`   | `references/revenuecat.md` |
| `Adapty`, `react-native-adapty`, `adapty_flutter`             | `references/adapty.md`     |
| `Qonversion`, `react-native-qonversion`, `qonversion_flutter` | `references/qonversion.md` |

If several exist, identify which one owns purchases before proceeding.

## Flow

1. Inventory configure, purchase, restore, entitlement, identity, attributes,
   presentation calls, and all callback side effects.
2. Choose billing ownership: Superwall, retained custom/store billing, or the
   existing provider as a purchase controller. Follow the chosen playbook.
3. Map store product ids unchanged, provider entitlements/access levels to
   Superwall entitlements, and each presentation call site to a placement.
4. Run `superwall apps list --json`; match the code's public key or bundle id and
   record explicit project/app ids. Stop on an account mismatch.
5. Recreate only missing dashboard resources with scoped JSON commands.
6. Add Superwall alongside the provider, replace presentation with placements,
   preserve purchase/restore side effects and identity lifecycle, then build.
7. Verify every placement and Restore Purchases as an existing subscriber.
8. Remove the old SDK only in full-migration mode and only after verification.
9. Hand back migrated code, created ids, evidence, and every remaining manual step.

## Non-negotiable seams

- Exactly one purchase owner and transaction finisher.
- Purchases outside Superwall must continuously sync subscription state through
  a purchase controller, observer mode, or explicit status updates.
- Preserve backend sync, analytics, attribution, cache refresh, and navigation
  from old purchase/restore callbacks.
- Identify before placements can fire; reset on logout, deletion, and forced
  session expiry.
- Put remotely gated work inside the placement feature callback.
- Never create dashboard resources until the logged-in app match is verified.

## CLI contract

Agents always use `--json` and explicit scope:

```bash
superwall whoami --json
superwall apps list --json
superwall entitlements list --project <projectId> --json
superwall entitlements create <id> --project <projectId> --json
superwall products list --project <projectId> --json
superwall products create <storeId> --project <projectId> --json
superwall campaigns list --project <projectId> --app <appId> --json
superwall campaigns create "<description>" <placement> --project <projectId> --app <appId> --json
superwall campaigns placement <campaignId> <placement> --project <projectId> --app <appId> --json
```

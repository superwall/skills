# User Management
Source: https://superwall.com/docs/expo/quickstart/user-management

### Anonymous Users

Superwall automatically generates a random user ID that persists internally until the user deletes/reinstalls your app.

You can call `Superwall.shared.reset()` to reset this ID and clear any paywall assignments.

### Identified Users

If you use your own user management system, call `identify(userId:options:)` when you have a user's identity. This will alias your `userId` with the anonymous Superwall ID enabling us to load the user’s assigned paywalls.

Calling `Superwall.shared.reset()` will reset the on-device userId to a random ID and clear the paywall assignments.

:::expo
If your Expo app targets Android, pass `{ passIdentifiersToPlayStore: true }` inside the options object you give to `Superwall.configure`. That ensures Google Play receives the plain `appUserId` as `obfuscatedExternalAccountId`; otherwise we send a hashed value. iOS builds ignore this option. Be sure the identifier satisfies [Google's requirements](https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.Builder#setObfuscatedAccountId) and never includes PII.
:::

:::expo
```tsx React Native
import { useUser } from "expo-superwall";

function UserManagement() {
  const { identify, signOut } = useUser();

  // After retrieving a user's ID, e.g. from logging in or creating an account
  const handleLogin = async (user) => {
    await identify(user.id);
  };

  // When the user signs out
  const handleSignOut = () => {
    signOut();
  };

  return (
    <>
      <Button onPress={() => handleLogin(user)} title="Login" />
      <Button onPress={handleSignOut} title="Sign Out" />
    </>
  );
}
```
:::

<br />

<Note>
  **Advanced Use Case**

  You can supply an `IdentityOptions` object, whose property `restorePaywallAssignments` you can set to `true`. This tells the SDK to wait to restore paywall assignments from the server before presenting any paywalls. This should only be used in advanced use cases. If you expect users of your app to switch accounts or delete/reinstall a lot, you'd set this when users log in to an existing account.
</Note>

### Best Practices for a Unique User ID

* Do NOT make your User IDs guessable – they are public facing.
* Do NOT set emails as User IDs – this isn't GDPR compliant.
* Do NOT set IDFA or DeviceIds as User IDs – these are device specific / easily rotated by the operating system.
* Do NOT hardcode strings as User IDs – this will cause every user to be treated as the same user by Superwall.

### Identifying users from App Store server events

On iOS, Superwall always supplies an [`appAccountToken`](https://developer.apple.com/documentation/storekit/product/purchaseoption/3749440-appaccounttoken) with every StoreKit 2 transaction:

| Scenario                                           | Value used for `appAccountToken`                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| You’ve called `Superwall.shared.identify(userId:)` | The exact `userId` you passed                                                                                         |
| You *haven’t* called `identify` yet                | The UUID automatically generated for the anonymous user (the **alias ID**), **without** the `$SuperwallAlias:` prefix |
| You passed a non‑UUID `userId` to `identify`       | StoreKit rejects it; Superwall falls back to the alias UUID                                                           |

Because the SDK falls back to the alias UUID, purchase notifications sent to your server always include a stable, unique identifier—even before the user signs in.

:::expo
<Warning>
  On iOS, `appAccountToken` must be a UUID to be accepted by StoreKit.

  If the `userId` you pass to `identify` is not a valid UUID string, StoreKit will not accept it for `appAccountToken` and the SDK will fall back to the anonymous alias UUID. This can cause the identifier in App Store Server Notifications to differ from the `userId` you passed. See Apple's docs: [appAccountToken](https://developer.apple.com/documentation/appstoreserverapi/appaccounttoken).
</Warning>
:::

```swift
// Generate and use a UUID user ID in Swift
let userId = UUID().uuidString
Superwall.shared.identify(userId: userId)
```

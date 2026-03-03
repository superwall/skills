# Setting User Attributes
Source: https://superwall.com/docs/expo/quickstart/setting-user-properties

By setting user attributes, you can display information about the user on the paywall. You can also define [audiences](/campaigns-audience) in a campaign to determine which paywall to show to a user, based on their user attributes.

<Note>
  If a paywall uses the **Set user attributes** action, the merged attributes are sent back to your app via `SuperwallDelegate.userAttributesDidChange(newAttributes:)`.
</Note>

You do this by passing a `[String: Any?]` dictionary of attributes to `Superwall.shared.setUserAttributes(_:)`:

:::expo
```tsx React Native
import { useUser } from "expo-superwall";

function UserProfile() {
  const { update } = useUser();

  const updateUserAttributes = async (user) => {
    await update({
      name: user.name,
      apnsToken: user.apnsTokenString,
      email: user.email,
      username: user.username,
      profilePic: user.profilePicUrl,
      stripe_customer_id: user.stripeCustomerId, // Optional: For Stripe checkout prefilling
    });
  };

  // Or update using a function that receives old attributes
  const incrementCounter = async () => {
    await update((oldAttributes) => ({
      ...oldAttributes,
      counter: (oldAttributes.counter || 0) + 1,
    }));
  };

  return (
    <>
      <Button onPress={() => updateUserAttributes(user)} title="Update Profile" />
      <Button onPress={incrementCounter} title="Increment Counter" />
    </>
  );
}
```
:::

## Usage

This is a merge operation, such that if the existing user attributes dictionary
already has a value for a given property, the old value is overwritten. Other
existing properties will not be affected. To unset/delete a value, you can pass `nil`
for the value.

You can reference user attributes in [audience filters](/campaigns-audience) to help decide when to display your paywall. When you configure your paywall, you can also reference the user attributes in its text variables. For more information on how to that, see [Configuring a Paywall](/paywall-editor-overview).

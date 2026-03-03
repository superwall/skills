# Configure the SDK
Source: https://superwall.com/docs/expo/quickstart/configure

<Note>
  Superwall does **not** refetch its configuration during hot reloads. So, if you add products, edit a paywall, or otherwise change anything with Superwall, re-run your app to see those changes.
</Note>

As soon as your app launches, you need to configure the SDK with your **Public API Key**. You'll retrieve this from the Superwall settings page.

### Sign Up & Grab Keys

If you haven't already, [sign up for a free account](https://superwall.com/sign-up) on Superwall. Then, when you're through to the Dashboard, click **Settings** from the panel on the left, click **Keys** and copy your **Public API Key**:

![](/images/810eaba-small-Screenshot_2023-04-25_at_11.51.13.png)

### Initialize Superwall in your app

To use the Superwall SDK, you need to wrap your application (or the relevant part of it) with the `<SuperwallProvider />`. This provider initializes the SDK with your API key.

```tsx
import { SuperwallProvider } from "expo-superwall";

// Replace with your actual Superwall API key
export default function App() {
  return (
    <SuperwallProvider apiKeys={{ ios: "YOUR_SUPERWALL_API_KEY" /* android: API_KEY */ }}>
      {/* Your app content goes here */}
    </SuperwallProvider>
  );
}
```

You've now configured Superwall!

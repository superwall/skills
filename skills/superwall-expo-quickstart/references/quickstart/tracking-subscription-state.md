# Tracking Subscription State
Source: https://superwall.com/docs/expo/quickstart/tracking-subscription-state

Here's how to view whether or not a user is on a paid plan in React Native.

Superwall tracks the subscription state of a user for you. However, there are times in your app where you need to know if a user is on a paid plan or not. For example, you might want to conditionally show certain UI elements or enable premium features based on their subscription status.

## Using the `useUser` hook

The easiest way to track subscription status in React Native is with the `useUser` hook from `expo-superwall`:

```tsx
import { useUser } from "expo-superwall";
import { useEffect, useState } from "react";
import { View, Text } from "react-native";

function SubscriptionStatusExample() {
  const { subscriptionStatus } = useUser();
  const [isPaidUser, setIsPaidUser] = useState(false);

  useEffect(() => {
    if (subscriptionStatus?.status === "ACTIVE") {
      console.log("User has active entitlements:", subscriptionStatus.entitlements);
      setIsPaidUser(true);
    } else {
      console.log("User is on free plan");
      setIsPaidUser(false);
    }
  }, [subscriptionStatus]);

  return (
    <View>
      <Text>User Status: {isPaidUser ? "Pro" : "Free"}</Text>
      <Text>Subscription: {subscriptionStatus?.status ?? "unknown"}</Text>
    </View>
  );
}
```

The `subscriptionStatus` object has the following structure:

* `status`: Can be `"ACTIVE"`, `"INACTIVE"`, or `"UNKNOWN"`
* `entitlements`: An array of active entitlements (only present when status is `"ACTIVE"`)

## Listening for subscription status changes

You can also listen for real-time subscription status changes using the `useSuperwallEvents` hook:

```tsx
import { useSuperwallEvents } from "expo-superwall";
import { useState } from "react";

function App() {
  const [isPro, setIsPro] = useState(false);

  useSuperwallEvents({
    onSubscriptionStatusChange: (status) => {
      if (status.status === "ACTIVE") {
        console.log("User upgraded to pro!");
        setIsPro(true);
      } else {
        console.log("User is on free plan");
        setIsPro(false);
      }
    },
  });

  return (
    // Your app content
  );
}
```

## Checking for specific entitlements

If your app has multiple subscription tiers (e.g., Bronze, Silver, Gold), you can check for specific entitlements:

```tsx
import { useUser } from "expo-superwall";

function PremiumFeature() {
  const { subscriptionStatus } = useUser();

  const hasGoldTier = subscriptionStatus?.entitlements?.some(
    (entitlement) => entitlement.id === "gold"
  );

  if (hasGoldTier) {
    return <GoldFeatureContent />;
  }

  return <UpgradePrompt />;
}
```

## Setting subscription status

When using Superwall with a custom purchase controller or third-party billing service, you need to manually update the subscription status. Here's how to sync with RevenueCat:

```tsx
import { useUser } from "expo-superwall";
import { useEffect } from "react";
import Purchases from "react-native-purchases";

function SubscriptionSync() {
  const { setSubscriptionStatus } = useUser();

  useEffect(() => {
    // Listen for RevenueCat customer info updates
    const listener = Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      const entitlementIds = Object.keys(customerInfo.entitlements.active);
      
      setSubscriptionStatus({
        status: entitlementIds.length === 0 ? "INACTIVE" : "ACTIVE",
        entitlements: entitlementIds.map(id => ({ 
          id, 
          type: "SERVICE_LEVEL" 
        }))
      });
    });

    // Get initial customer info
    const syncInitialStatus = async () => {
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        const entitlementIds = Object.keys(customerInfo.entitlements.active);
        
        setSubscriptionStatus({
          status: entitlementIds.length === 0 ? "INACTIVE" : "ACTIVE",
          entitlements: entitlementIds.map(id => ({ 
            id, 
            type: "SERVICE_LEVEL" 
          }))
        });
      } catch (error) {
        console.error("Failed to sync initial subscription status:", error);
      }
    };

    syncInitialStatus();

    return () => {
      listener?.remove();
    };
  }, [setSubscriptionStatus]);

  return null; // This component just handles the sync
}
```

## Using subscription status emitter

You can also listen to subscription status changes using the event emitter directly:

```tsx
import Superwall from "expo-superwall";
import { useEffect } from "react";

function SubscriptionListener() {
  useEffect(() => {
    const subscription = Superwall.shared.subscriptionStatusEmitter.addListener(
      "change",
      (status) => {
        switch (status.status) {
          case "ACTIVE":
            console.log("Active entitlements:", status.entitlements);
            break;
          case "INACTIVE":
            console.log("No active subscription");
            break;
          case "UNKNOWN":
            console.log("Subscription status unknown");
            break;
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}
```

## Superwall checks subscription status for you

Remember that the Superwall SDK uses its [audience filters](/campaigns-audience#matching-to-entitlements) for determining when to show paywalls. You generally don't need to wrap your calls to register placements with subscription status checks:

```tsx
// ❌ Unnecessary
if (subscriptionStatus?.status !== "ACTIVE") {
  await Superwall.shared.register({ placement: "campaign_trigger" });
}

// ✅ Just register the placement
await Superwall.shared.register({ placement: "campaign_trigger" });
```

In your [audience filters](/campaigns-audience#matching-to-entitlements), you can specify whether the subscription state should be considered, which keeps your codebase cleaner and puts the "Should this paywall show?" logic where it belongs—in the Superwall dashboard.

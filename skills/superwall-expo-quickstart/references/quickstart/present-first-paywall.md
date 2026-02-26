# Present Your First Paywall
Source: https://superwall.com/docs/expo/quickstart/present-first-paywall

Learn how to present paywalls in your app.

## Placements

With Superwall, you present paywalls by registering a [Placement](/campaigns-placements). Placements are the configurable entry points to show (or not show) paywalls based on your [Campaigns](/campaigns) as setup in your Superwall dashboard.

The placement `campaign_trigger` is set to show an example paywall by default.

## Usage

The [`usePlacement`](/expo/sdk-reference/hooks/usePlacement) hook allows you to register placements that you've configured in your Superwall dashboard.
The hook returns a `registerPlacement` function that you can use to register a placement.

```tsx
import { usePlacement, useUser } from "expo-superwall";
import { Alert, Button, Text, View } from "react-native";

function PaywallScreen() {
  const { registerPlacement, state: placementState } = usePlacement({
    onError: (err) => console.error("Placement Error:", err),
    onPresent: (info) => console.log("Paywall Presented:", info),
    onDismiss: (info, result) =>
      console.log("Paywall Dismissed:", info, "Result:", result),
  });

  const handleTriggerPlacement = async () => {
    await registerPlacement({
      placement: "campaign_trigger"
    });
  };

  return (
    <View style={{ padding: 20 }}>
      <Button title="Show Paywall" onPress={handleTriggerPlacement} />
      {placementState && (
        <Text>Last Paywall Result: {JSON.stringify(placementState)}</Text>
      )}
    </View>
  );
}
```

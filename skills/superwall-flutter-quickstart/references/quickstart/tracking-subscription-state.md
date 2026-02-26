# Tracking Subscription State
Source: https://superwall.com/docs/flutter/quickstart/tracking-subscription-state

Here's how to view whether or not a user is on a paid plan in Flutter.

Superwall tracks the subscription state of a user for you. However, there are times in your app where you need to know if a user is on a paid plan or not. For example, you might want to conditionally show certain UI elements or enable premium features based on their subscription status.

## Using subscriptionStatus stream

The easiest way to track subscription status in Flutter is by listening to the `subscriptionStatus` stream:

```dart
class _MyAppState extends State<MyApp> {
  StreamSubscription<SubscriptionStatus>? _subscription;
  SubscriptionStatus _currentStatus = SubscriptionStatus.unknown;
  
  @override
  void initState() {
    super.initState();
    
    _subscription = Superwall.shared.subscriptionStatus.listen((status) {
      setState(() {
        _currentStatus = status;
      });
      
      switch (status) {
        case SubscriptionStatus.active:
          print('User has active subscription');
          _showPremiumContent();
          break;
        case SubscriptionStatus.inactive:
          print('User is on free plan');
          _showFreeContent();
          break;
        case SubscriptionStatus.unknown:
          print('Subscription status unknown');
          _showLoadingState();
          break;
      }
    });
  }
  
  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
```

The `SubscriptionStatus` enum has three possible values:

* `SubscriptionStatus.unknown` - Status is not yet determined
* `SubscriptionStatus.active` - User has an active subscription
* `SubscriptionStatus.inactive` - User has no active subscription

Use the `isActive` convenience property when you only need to know if the user is subscribed:

```dart
Superwall.shared.subscriptionStatus.listen((status) {
  if (status.isActive) {
    _showPremiumContent();
  } else {
    _showFreeContent();
  }
});
```

## Using SuperwallBuilder widget

For reactive UI updates based on subscription status, use the `SuperwallBuilder` widget:

```dart
SuperwallBuilder(
  builder: (context, subscriptionStatus) {
    switch (subscriptionStatus) {
      case SubscriptionStatus.active:
        return PremiumContent();
      case SubscriptionStatus.inactive:
        return FreeContent();
      default:
        return LoadingIndicator();
    }
  },
)
```

This widget automatically rebuilds whenever the subscription status changes, making it perfect for conditionally rendering UI:

```dart
class SubscriptionStatusDisplay extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SuperwallBuilder(
      builder: (context, status) => Center(
        child: Text('Subscription Status: $status'),
      ),
    );
  }
}
```

## Using StreamBuilder

You can also use Flutter's `StreamBuilder` for more control over the stream subscription:

```dart
class PremiumFeatureButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SubscriptionStatus>(
      stream: Superwall.shared.subscriptionStatus,
      builder: (context, snapshot) {
        final status = snapshot.data ?? SubscriptionStatus.unknown;
        final isActive = status.isActive;
        
        return ElevatedButton(
          onPressed: isActive
              ? _accessPremiumFeature
              : _showPaywall,
          child: Text(
            isActive
                ? 'Access Premium Feature'
                : 'Upgrade to Premium',
          ),
        );
      },
    );
  }
  
  void _accessPremiumFeature() {
    // Access premium feature
  }
  
  void _showPaywall() {
    Superwall.shared.registerPlacement('premium_feature');
  }
}
```

## Checking subscription status programmatically

If you need to check the subscription status at a specific moment without listening to the stream:

```dart
Future<void> checkSubscription() async {
  // Note: You'll need to get the current value from the stream
  final subscription = Superwall.shared.subscriptionStatus.listen((status) {
    if (status.isActive) {
      // User is subscribed
      enablePremiumFeatures();
    } else {
      // User is not subscribed
      showUpgradePrompt();
    }
  });
  
  // Remember to cancel when done
  subscription.cancel();
}
```

## Setting subscription status

When using Superwall with a custom purchase controller or third-party billing service, you need to manually update the subscription status. Here's how to sync with RevenueCat:

```dart
class RCPurchaseController extends PurchaseController {
  
  Future<void> syncSubscriptionStatus() async {
    try {
      final customerInfo = await Purchases.getCustomerInfo();
      final hasActiveSubscription = customerInfo.entitlements.active.isNotEmpty;
      
      if (hasActiveSubscription) {
        final entitlements = customerInfo.entitlements.active.keys
            .map((id) => Entitlement(id: id))
            .toSet();
        await Superwall.shared.setSubscriptionStatus(
          SubscriptionStatusActive(entitlements: entitlements)
        );
      } else {
        await Superwall.shared.setSubscriptionStatus(
          SubscriptionStatusInactive()
        );
      }
    } catch (e) {
      print('Failed to sync subscription status: $e');
    }
  }
  
  @override
  Future<PurchaseResult> purchaseFromAppStore(String productId) async {
    try {
      final result = await Purchases.purchaseProduct(productId);
      
      if (result.isSuccess) {
        // Sync status after successful purchase
        await syncSubscriptionStatus();
        return PurchaseResult.purchased;
      }
      
      return PurchaseResult.failed;
    } catch (e) {
      return PurchaseResult.failed;
    }
  }
}
```

You can also listen for subscription changes from your payment service:

```dart
void setupSubscriptionListener() {
  myPaymentService.addSubscriptionStatusListener((subscriptionInfo) {
    final entitlements = subscriptionInfo.entitlements.active.keys
        .map((id) => Entitlement(id: id))
        .toSet();
    final hasActiveSubscription = subscriptionInfo.isActive;

    if (hasActiveSubscription) {
      Superwall.shared.setSubscriptionStatus(
        SubscriptionStatusActive(entitlements: entitlements)
      );
    } else {
      Superwall.shared.setSubscriptionStatus(
        SubscriptionStatusInactive()
      );
    }
  });
}
```

## Using SuperwallDelegate

You can also listen for subscription status changes using the `SuperwallDelegate`:

```dart
class _MyAppState extends State<MyApp> implements SuperwallDelegate {
  
  @override
  void initState() {
    super.initState();
    
    // Set delegate
    Superwall.shared.setDelegate(this);
  }
  
  @override
  void subscriptionStatusDidChange(SubscriptionStatus newValue) {
    print('Subscription status changed to: $newValue');
    
    switch (newValue) {
      case SubscriptionStatus.active:
        print('User is now premium');
        _handlePremiumUser();
        break;
      case SubscriptionStatus.inactive:
        print('User is now free');
        _handleFreeUser();
        break;
      case SubscriptionStatus.unknown:
        print('Status unknown');
        break;
    }
  }
  
  void _handlePremiumUser() {
    // Update UI or app state for premium user
  }
  
  void _handleFreeUser() {
    // Update UI or app state for free user
  }
}
```

## Handling subscription expiry

If you need to check for subscription expiry manually:

```dart
Future<void> checkSubscriptionExpiry() async {
  final expiryDate = await MyPaymentService.getSubscriptionExpiry();
  
  if (expiryDate.isBefore(DateTime.now())) {
    // Subscription has expired
    await Superwall.shared.setSubscriptionStatus(
      SubscriptionStatusInactive()
    );
    
    // Show renewal prompt
    _showRenewalPrompt();
  }
}
```

## Superwall checks subscription status for you

Remember that the Superwall SDK uses its [audience filters](/campaigns-audience#matching-to-entitlements) for determining when to show paywalls. You generally don't need to wrap your calls to register placements with subscription status checks:

```dart
// ❌ Unnecessary
final subscription = Superwall.shared.subscriptionStatus.listen((status) {
  if (status != SubscriptionStatus.active) {
    Superwall.shared.registerPlacement('campaign_trigger');
  }
});

// ✅ Just register the placement
Superwall.shared.registerPlacement('campaign_trigger');
```

In your [audience filters](/campaigns-audience#matching-to-entitlements), you can specify whether the subscription state should be considered, which keeps your codebase cleaner and puts the "Should this paywall show?" logic where it belongs—in the Superwall dashboard.

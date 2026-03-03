# Tracking Subscription State
Source: https://superwall.com/docs/ios/quickstart/tracking-subscription-state

Monitor user subscription status in your iOS app

Superwall tracks the subscription state of a user for you. So, you don't need to add in extra logic for this. However, there are times in your app where you simply want to know if a user is on a paid plan or not. In your app's models, you might wish to set a flag representing whether or not a user is on a paid subscription:

```swift
@Observable 
class UserData {
    var isPaidUser: Bool = false
}
```

### Using subscription status

You can do this by observing the `subscriptionStatus` property on `Superwall.shared`. This property is an enum that represents the user's subscription status:

```swift
switch Superwall.shared.subscriptionStatus {
case .active(let entitlements):
    logger.info("User has active entitlements: \(entitlements)")
    userData.isPaidUser = true
case .inactive:
    logger.info("User is free plan.")
    userData.isPaidUser = false 
case .unknown:
    logger.info("User is inactive.")
    userData.isPaidUser = false
}
```

One natural way to tie the logic of your model together with Superwall's subscription status is by having your own model conform to the [Superwall Delegate](/using-superwall-delegate):

```swift
@Observable 
class UserData {
    var isPaidUser: Bool = false
}

extension UserData: SuperwallDelegate {
    // MARK: Superwall Delegate
    
    func subscriptionStatusDidChange(from oldValue: SubscriptionStatus, to newValue: SubscriptionStatus) {
        switch newValue {
        case .active(_):
            // If you're using more than one entitlement, you can check which one is active here.
            // This example just assumes one is being used.
            logger.info("User is pro plan.")
            self.isPaidUser = true
        case .inactive:
            logger.info("User is free plan.")
            self.isPaidUser = false
        case .unknown:
            logger.info("User is free plan.")
            self.isPaidUser = false
        }
    }
}
```

Another shorthand way to check? The `isActive` flag, which returns true if any entitlement is active:

```swift
if Superwall.shared.subscriptionStatus.isActive {
    userData.isPaidUser = true 
}
```

:::ios
### Listening for entitlement changes in SwiftUI

For Swift based apps, you can also create a flexible custom modifier which would fire if any changes to a subscription state occur. Here's how:

```swift
import Foundation 
import SuperwallKit 
import SwiftUI

// MARK: - Notification Handling

extension NSNotification.Name {
    static let entitlementDidChange = NSNotification.Name("entitlementDidChange")
}

extension NotificationCenter {
    func entitlementChangedPublisher() -> NotificationCenter.Publisher {
        return self.publisher(for: .entitlementDidChange)
    }
}

// MARK: View Modifier
private struct EntitlementChangedModifier: ViewModifier {
    // Or, change the `Bool` to `Set<Entitlement>` if you want to know which entitlements are active.
    // This example assumes you're only using one.
    let handler: (Bool) -> ()
    
    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.entitlementChangedPublisher(),
                       perform: { _ in
                switch Superwall.shared.subscriptionStatus {
                case .active(_):
                    handler(true)
                case .inactive:
                    handler(false)
                case .unknown:
                    handler(false)
                }
            })
    }
}

// MARK: View Extensions

extension View {
    func onEntitlementChanged(_ handler: @escaping (Bool) -> ()) -> some View {
        self.modifier(EntitlementChangedModifier(handler: handler))
    }
}

// Then, in any view, this modifier will fire when the subscription status changes

struct SomeView: View {
    @State private var isPro: Bool = false

    var body: some View {
        VStack {
            Text("User is pro: \(isPro ? "Yes" : "No")")
        }
        .onEntitlementChanged { isPro in
            self.isPro = isPro
        }
    }
}
```
:::

### Superwall checks subscription status for you

Remember that the Superwall SDK uses its [audience filters](/campaigns-audience#matching-to-entitlements) for a similar purpose. You generally don't need to wrap your calls registering placements around `if` statements checking if a user is on a paid plan, like this:

```swift
// Unnecessary
if !Superwall.shared.subscriptionStatus.isActive {
    Superwall.shared.register(placement: "campaign_trigger")
}
```

In your audience filters, you can specify whether or not the subscription state should be considered...

<Frame>
  ![](/images/entitlementCheck.png)
</Frame>

...which eliminates the needs for code like the above. This keeps you code base cleaner, and the responsibility of "Should this paywall show" within the Superwall campaign platform as it was designed.

# Presenting Paywalls
Source: https://superwall.com/docs/ios/quickstart/feature-gating

Control access to premium features with Superwall placements

This allows you to register a [placement](/campaigns-placements) to access a feature that may or may not be paywalled later in time. It also allows you to choose whether the user can access the feature even if they don't make a purchase.

Here's an example.

#### With Superwall

:::ios
<Tabs items={["Swift","Objective-C"]} groupId="language" persist>
  <Tab value="Swift">
    ```swift Swift
    func pressedWorkoutButton() {
      // remotely decide if a paywall is shown and if
      // navigation.startWorkout() is a paid-only feature
      Superwall.shared.register(placement: "StartWorkout") {
        navigation.startWorkout()
      }
    }
    ```
  </Tab>

  <Tab value="Objective-C">
    ```swift Objective-C
    - (void)pressedWorkoutButton {
      // remotely decide if a paywall is shown and if
      // navigation.startWorkout() is a paid-only feature
      [[Superwall sharedInstance] registerWithPlacement:@"StartWorkout" params:nil handler:nil feature:^{
        [navigation startWorkout];
      }];
    }
    ```
  </Tab>
</Tabs>
:::

#### Without Superwall

:::ios
<Tabs items={["Swift","Objective-C"]} groupId="language" persist>
  <Tab value="Swift">
    ```swift Swift
    func pressedWorkoutButton() {
      if (user.hasActiveSubscription) {
        navigation.startWorkout()
      } else {
        navigation.presentPaywall() { result in
          if (result) {
            navigation.startWorkout()
          } else {
            // user didn't pay, developer decides what to do
          }
        }
      }
    }
    ```
  </Tab>

  <Tab value="Objective-C">
    ```swift Objective-C
    - (void)pressedWorkoutButton {
      if (user.hasActiveSubscription) {
        [navigation startWorkout];
      } else {
        [navigation presentPaywallWithCompletion:^(BOOL result) {
          if (result) {
            [navigation startWorkout];
          } else {
            // user didn't pay, developer decides what to do
          }
        }];
      }
    }
    ```
  </Tab>
</Tabs>
:::

### How registering placements presents paywalls

You can configure `"StartWorkout"` to present a paywall by [creating a campaign, adding the placement, and adding a paywall to an audience](/campaigns) in the dashboard.

1. The SDK retrieves your campaign settings from the dashboard on app launch.
2. When a placement is called that belongs to a campaign, audiences are evaluated ***on device*** and the user enters an experiment — this means there's no delay between registering a placement and presenting a paywall.
3. If it's the first time a user is entering an experiment, a paywall is decided for the user based on the percentages you set in the dashboard
4. Once a user is assigned a paywall for an audience, they will continue to see that paywall until you remove the paywall from the audience or reset assignments to the paywall.
5. After the paywall is closed, the Superwall SDK looks at the *Feature Gating* value associated with your paywall, configurable from the paywall editor under General > Feature Gating (more on this below)
   1. If the paywall is set to ***Non Gated***, the `feature:` closure on `register(placement: ...)` gets called when the paywall is dismissed (whether they paid or not)
   2. If the paywall is set to ***Gated***, the `feature:` closure on `register(placement: ...)` gets called only if the user is already paying or if they begin paying.
6. If no paywall is configured, the feature gets executed immediately without any additional network calls.

Given the low cost nature of how register works, we strongly recommend registering **all core functionality** in order to remotely configure which features you want to gate – **without an app update**.

:::ios
<Tabs items={["Swift","Objective-C"]} groupId="language" persist>
  <Tab value="Swift">
    ```swift Swift
    // on the welcome screen
    func pressedSignUp() {
      Superwall.shared.register(placement: "SignUp") {
        navigation.beginOnboarding()
      }
    }

    // in another view controller
    func pressedWorkoutButton() {
      Superwall.shared.register(placement: "StartWorkout") {
        navigation.startWorkout()
      }
    }

    ```
  </Tab>

  <Tab value="Objective-C">
    ```swift Objective-C
    // on the welcome screen
    - (void)pressedSignUp {
      [[Superwall sharedInstance] registerWithPlacement:@"SignUp" params:nil handler:nil feature:^{
        [navigation beginOnboarding];
      }];
    }

    // In another view controller
    - (void)pressedWorkoutButton {
      [[Superwall sharedInstance] registerWithPlacement:@"StartWorkout" params:nil handler:nil feature:^{
        [navigation startWorkout];
      }];
    }
    ```
  </Tab>
</Tabs>
:::

### Automatically Registered Placements

The SDK [automatically registers](/tracking-analytics) some internal placements which can be used to present paywalls:

### Register. Everything.

To provide your team with ultimate flexibility, we recommend registering *all* of your analytics events, even if you don't pass feature blocks through. This way you can retroactively add a paywall almost anywhere – **without an app update**!

If you're already set up with an analytics provider, you'll typically have an `Analytics.swift` singleton (or similar) to disperse all your events from. Here's how that file might look:

:::ios
```swift Swift
import SuperwallKit
import Mixpanel
import Firebase

final class Analytics {
  static var shared = Analytics()

  func track(
    event: String,
    properties: [String: Any]
  ) {
    // Superwall
    Superwall.shared.register(placement: event, params: properties)

    // Firebase (just an example)
    Firebase.Analytics.logEvent(event, parameters: properties)

    // Mixpanel (just an example)
    Mixpanel.mainInstance().track(event: event, properties: properties)
  }
}


// And thus ...

Analytics.shared.track(
  event: "workout_complete",
  properties: ["total_workouts": 17]
)

// ... can now be turned into a paywall moment :)
```
:::

### Getting a presentation result

Use `getPresentationResult(forPlacement:params:)` when you need to ask the SDK what would happen when registering a placement — without actually showing a paywall. Superwall evaluates the placement and its audience filters then returns a `PresentationResult`. You can use this to adapt your app's behavior based on the outcome (such as showing a lock icon next to a pro feature if they aren't subscribed).

In short, this lets you peek at the outcome first and decide how your app should respond:

:::ios
```swift
Task {
    let res = await Superwall.shared.getPresentationResult(forPlacement: "caffeineLogged")
    switch res {
    case .placementNotFound:
        // The placement name isn’t on any campaign in the dashboard.
        print("Superwall: Placement \"caffeineLogged\" not found ‑ double‑check spelling and dashboard setup.")
    case .noAudienceMatch:
        // The placement exists, but the user didn’t fall into any audience filters.
        print("Superwall: No matching audience for this user — paywall skipped.")
    case .paywall(let experiment):
        // User qualifies and will see the paywall for this experiment.
        print("Superwall: Showing paywall (experiment \(experiment.id)).")
    case .holdout(let experiment):
        // User is in the control/holdout group, so no paywall is shown.
        print("Superwall: User assigned to holdout group for experiment \(experiment.id) — paywall withheld.")
    case .paywallNotAvailable:
        // A paywall *would* have been shown, but some error likely occurred (e.g., no VC to present from, networking, etc).
        print("Superwall: Paywall not available — likely no internet, no presenting view controller, or another paywall is already visible.")
    }
}
```
:::

# Presenting Paywalls
Source: https://superwall.com/docs/android/quickstart/feature-gating

Control access to premium features with Superwall placements.

This allows you to register a [placement](/campaigns-placements) to access a feature that may or may not be paywalled later in time. It also allows you to choose whether the user can access the feature even if they don't make a purchase.

Here's an example.

#### With Superwall

:::android
```kotlin Kotlin
fun pressedWorkoutButton() {
  // remotely decide if a paywall is shown and if
  // navigation.startWorkout() is a paid-only feature
  Superwall.instance.register("StartWorkout") {
    navigation.startWorkout()
  }
}
```
:::

#### Without Superwall

:::android
```kotlin Kotlin
fun pressedWorkoutButton() {
  if (user.hasActiveSubscription) {
    navigation.startWorkout()
  } else {
    navigation.presentPaywall { result ->
      if (result) {
        navigation.startWorkout()
      } else {
        // user didn't pay, developer decides what to do
      }
    }
  }
}
```
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

:::android
```kotlin Kotlin
// on the welcome screen
fun pressedSignUp() {
  Superwall.instance.register("SignUp") {
    navigation.beginOnboarding()
  }
}

// in another view controller
fun pressedWorkoutButton() {
  Superwall.instance.register("StartWorkout") {
    navigation.startWorkout()
  }
}
```
:::

### Automatically Registered Placements

The SDK [automatically registers](/tracking-analytics) some internal placements which can be used to present paywalls:

### Register. Everything.

To provide your team with ultimate flexibility, we recommend registering *all* of your analytics events, even if you don't pass feature blocks through. This way you can retroactively add a paywall almost anywhere – **without an app update**!

If you're already set up with an analytics provider, you'll typically have an `Analytics.swift` singleton (or similar) to disperse all your events from. Here's how that file might look:

### Getting a presentation result

Use `getPresentationResult(forPlacement:params:)` when you need to ask the SDK what would happen when registering a placement — without actually showing a paywall. Superwall evaluates the placement and its audience filters then returns a `PresentationResult`. You can use this to adapt your app's behavior based on the outcome (such as showing a lock icon next to a pro feature if they aren't subscribed).

In short, this lets you peek at the outcome first and decide how your app should respond:

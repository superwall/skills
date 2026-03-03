# Configure the SDK
Source: https://superwall.com/docs/ios/quickstart/configure

As soon as your app launches, you need to configure the SDK with your **Public API Key**. You'll retrieve this from the Superwall settings page.

### Sign Up & Grab Keys

If you haven't already, [sign up for a free account](https://superwall.com/sign-up) on Superwall. Then, when you're through to the Dashboard, click **Settings** from the panel on the left, click **Keys** and copy your **Public API Key**:

![](/images/810eaba-small-Screenshot_2023-04-25_at_11.51.13.png)

### Initialize Superwall in your app

Begin by editing your main Application entrypoint. Depending on the
platform this could be `AppDelegate.swift` or `SceneDelegate.swift` for iOS,
`MainApplication.kt` for Android, `main.dart` in Flutter, or `App.tsx` for React Native:

:::ios
<Tabs items={["Swift-UIKit","SwiftUI","Objective-C"]} groupId="language" persist>
  <Tab value="Swift-UIKit">
    ```swift Swift-UIKit
    // AppDelegate.swift

    import UIKit
    import SuperwallKit

    @main
    final class AppDelegate: UIResponder, UIApplicationDelegate {
      func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
      ) -> Bool {
        Superwall.configure(apiKey: "MY_API_KEY") // Replace this with your API Key
        return true
      }
    }
    ```
  </Tab>

  <Tab value="SwiftUI">
    ```swift SwiftUI
    // App.swift

    import SwiftUI
    import SuperwallKit

    @main
    struct MyApp: App {
      init() {
        let apiKey = "MY_API_KEY" // Replace this with your API Key
        Superwall.configure(apiKey: apiKey)
      }

      // etc...
    }
    ```
  </Tab>

  <Tab value="Objective-C">
    ```swift Objective-C
    // AppDelegate.m

    @import SuperwallKit;

    - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
        // Initialize the Superwall service.
        [Superwall configureWithApiKey:@"MY_API_KEY"];
        return YES;
    }
    ```
  </Tab>
</Tabs>
:::

This configures a shared instance of `Superwall`, the primary class for interacting with the SDK's API. Make sure to replace `MY_API_KEY` with your public API key that you just retrieved.

<Note>
  By default, Superwall handles basic subscription-related logic for you. However, if you’d like
  greater control over this process (e.g. if you’re using RevenueCat), you’ll want to pass in a
  `PurchaseController` to your configuration call and manually set the `subscriptionStatus`. You can
  also pass in `SuperwallOptions` to customize the appearance and behavior of the SDK. See
  [Purchases and Subscription Status](/advanced-configuration) for more.
</Note>

You've now configured Superwall!

:::ios
For further help, check out our [iOS example apps](https://github.com/superwall/Superwall-iOS/tree/master/Examples) for working examples of implementing the Superwall SDK.
:::

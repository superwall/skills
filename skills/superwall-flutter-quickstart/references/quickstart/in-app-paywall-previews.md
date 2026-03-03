# Handling Deep Links
Source: https://superwall.com/docs/flutter/quickstart/in-app-paywall-previews

1. Previewing paywalls on your device before going live.
2. Deep linking to specific [campaigns](/campaigns).
3. Web Checkout [Post-Checkout Redirecting](/web-checkout-post-checkout-redirecting)

## Setup

:::flutter
There are two ways to deep link into your app: URL Schemes and Universal Links (iOS only).
:::

### Adding a Custom URL Scheme

:::flutter
#### iOS

Open **Xcode**. In your **info.plist**, add a row called **URL Types**. Expand the automatically created **Item 0**, and inside the **URL identifier** value field, type your **Bundle ID**, e.g., **com.superwall.Superwall-SwiftUI**. Add another row to **Item 0** called **URL Schemes** and set its **Item 0** to a URL scheme you'd like to use for your app, e.g., **exampleapp**. Your structure should look like this:

<Frame>
  ![](/images/1.png)
</Frame>

With this example, the app will open in response to a deep link with the format **exampleapp\://**. You can [view Apple's documentation](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app) to learn more about custom URL schemes.
:::

:::flutter
#### Android

Add the following to your `AndroidManifest.xml` file:

```xml
<activity android:name=".MainActivity">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="exampleapp" />
    </intent-filter>
</activity>
```

This configuration allows your app to open in response to a deep link with the format `exampleapp://` from your `MainActivity` class.
:::

:::flutter
### Adding a Universal Link (iOS only)

<Note>
  Only required for [Web Checkout](/web-checkout), otherwise you can skip this step.
</Note>

Before configuring in your app, first [create](/web-checkout-creating-an-app) and [configure](/web-checkout-configuring-stripe-keys-and-settings) your Stripe app on the Superwall Dashboard.

#### Add a new capability in Xcode

Select your target in Xcode, then select the **Signing & Capabilities** tab. Click on the **+ Capability** button and select **Associated Domains**. This will add a new capability to your app.

<Frame>
  ![](/images/web-checkout-ul-add.png)
</Frame>

#### Set the domain

Next, enter in the domain using the format `applinks:[your-web-checkout-url]`. This is the domain that Superwall will use to handle universal links. Your `your-web-checkout-url` value should match what's under the "Web Paywall Domain" section.

<Frame>
  ![](/images/web-checkout-ul-domain.png)
</Frame>

#### Testing

<Warning>
  If your Stripe app's iOS Configuration is incomplete or incorrect, universal links **will not work**
</Warning>

You can verify that your universal links are working a few different ways. Keep in mind that it usually takes a few minutes for the associated domain file to propagate:

1. **Use Branch's online validator:** If you visit [branch.io's online validator](https://branch.io/resources/aasa-validator//) and enter in your web checkout URL, it'll run a similar check and provide the same output.

2. **Test opening a universal link:** If the validation passes from either of the two steps above, make sure visiting a universal link opens your app. Your link should be formatted as `https://[your web checkout link]/app-link/` — which is simply your web checkout link with `/app-link/` at the end. This is easiest to test on device, since you have to tap an actual link instead of visiting one directly in Safari or another browser. In the iOS simulator, adding the link in the Reminders app works too:

<Frame>
  ![](/images/web-checkout-test-link.jpg)
</Frame>
:::

### Handling Deep Links

:::flutter
In your `pubspec.yaml` file, add the `uni_links` package to your dependencies:

```yaml
dependencies:
  uni_links: ^0.5.1
```

Then, run `flutter pub get` to install the package. Next, in your Flutter app, use the Superwall SDK to handle the deep link via `Superwall.shared.handleDeepLink(theLink);`. Here's a complete example:

```dart
import 'package:flutter/material.dart';
import 'package:superwallkit_flutter/superwallkit_flutter.dart';
import 'package:uni_links/uni_links.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  MyApp();

  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();
    Superwall.configure('YOUR_SUPERWALL_API_KEY');
    _handleIncomingLinks();
  }

  void _handleIncomingLinks() {
    uriLinkStream.listen((Uri? uri) {
      if (uri != null) {
        Superwall.shared.handleDeepLink(uri);
      }
    }, onError: (Object err) {
      print('Error receiving incoming link: $err');
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: Text(
            'Deep Link Preview Example',
            style: TextStyle(fontSize: 24),
          ),
        ),
      ),
    );
  }
}
```
:::

## Previewing Paywalls

Next, build and run your app on your phone.

Then, head to the Superwall Dashboard. Click on **Settings** from the Dashboard panel on the left, then select **General**:

<Frame>
  ![](/images/c252198-image.png)
</Frame>

With the **General** tab selected, type your custom URL scheme, without slashes, into the **Apple Custom URL Scheme** field:

<Frame>
  ![](/images/6b3f37e-image.png)
</Frame>

Next, open your paywall from the dashboard and click **Preview**. You'll see a QR code appear in a pop-up:

<Frame>
  ![](/images/2.png)
</Frame>

<br />

<Frame>
  ![](/images/3.png)
</Frame>

On your device, scan this QR code. You can do this via Apple's Camera app. This will take you to a paywall viewer within your app, where you can preview all your paywalls in different configurations.

## Using Deep Links to Present Paywalls

Deep links can also be used as a placement in a campaign to present paywalls. Simply add `deepLink_open` as an placement, and the URL parameters of the deep link can be used as parameters! You can also use custom placements for this purpose. [Read this doc](/presenting-paywalls-from-one-another) for examples of both.

## Related deep link guides

:::flutter
* [Handling Deep Links](/flutter/guides/handling-deep-links) — Use `handleDeepLink` with the `deepLink_open` standard placement and dashboard campaign rules to present paywalls from deep links, without hardcoding routing logic in your app.
* [Using Superwall Deep Links](/flutter/guides/superwall-deep-links) — Trigger paywalls or custom in-app behavior using Superwall-hosted URLs at `*.superwall.app/app-link/...`.
:::

# Install the SDK
Source: https://superwall.com/docs/flutter/quickstart/install

Install the Superwall Flutter SDK via pub package manager.

## Overview

To see the latest release, [check out the repository](https://github.com/superwall/Superwall-Flutter).

## Install via pubspec.yaml

To use Superwall in your Flutter project, add `superwallkit_flutter` as a dependency in your `pubspec.yaml` file:

```yaml
dependencies:
  superwallkit_flutter: ^2.0.5
```

After adding the dependency, run `dart pub get` in your terminal to fetch the package.

## Install via Command Line (Alternative)

You can also add the dependency directly from your terminal using the following command:

```bash
$ flutter pub add superwallkit_flutter
```

### iOS Deployment Target

Superwall requires iOS 14.0 or higher. Ensure your Flutter project's iOS deployment target is 14.0 or higher by updating ios/Podfile.

```ruby
platform :ios, '14.0'
```

### Android Configuration

First, add our SuperwallActivity to your `AndroidManifest.xml`:

```xml
   <!-- ... inside your <application> tag  -->
  <activity
    android:name="com.superwall.sdk.paywall.view.SuperwallPaywallActivity"
    android:theme="@style/Theme.MaterialComponents.DayNight.NoActionBar"
    android:configChanges="orientation|screenSize|keyboardHidden">
  </activity>

  <!-- Optional -->
  <activity android:name="com.superwall.sdk.debug.DebugViewActivity" />
  <activity android:name="com.superwall.sdk.debug.localizations.SWLocalizationActivity" />
  <activity android:name="com.superwall.sdk.debug.SWConsoleActivity" />
```

Superwall requires a minimum SDK version of 26 or higher and a minimum compile SDK target of 34. Ensure your Flutter project's Android minimal SDK target is set to 26 or higher and that your compilation SDK target is 34 by updating `android/app/build.gradle`.

```groovy gradle
android {
    ...
    compileSdkVersion 34
    ...
    defaultConfig {
        ...
        minSdkVersion 26
        ...
    }
}
```

To use the compile target SDK 34, you'll also need to ensure your Gradle version is 8.6 or higher and your Android Gradle plugin version is 8.4 or higher.
You can do that by checking your `gradle/wrapepr/gradle-wrapper.properties` file and ensuring it is updated to use the latest Gradle version:

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.6-bin.zip
```

And your `android/build.gradle` file is updated to use the latest Android Gradle plugin version:

```groovy gradle
plugins {
    id 'com.android.application' version '8.4.1' apply false
}
```

To find the latest compatible versions, you can always check the [Gradle Plugin Release Notes](https://developer.android.com/build/releases/gradle-plugin).

<Check>**And you're done!** Now you're ready to configure the SDK 👇</Check>

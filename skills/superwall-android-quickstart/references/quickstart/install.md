# Install the SDK
Source: https://superwall.com/docs/android/quickstart/install

Install the Superwall Android SDK via Gradle.

## Overview

To see the latest release, [check out the repository](https://github.com/superwall/Superwall-Android)

## Install via Gradle

[Gradle](https://developer.android.com/build/releases/gradle-plugin) is the
preferred way to install Superwall for Android.

In your `build.gradle` or `build.gradle.kts` add the latest Superwall SDK. You
can find the [latest release here](https://github.com/superwall/Superwall-Android/releases).

<Frame>![](/images/installation/build-gradle-app.png)</Frame>

<Tabs items={["build.gradle","build.gradle.kts","libs.version.toml"]} groupId="language" persist>
  <Tab value="build.gradle">
    ```groovy build.gradle
    implementation "com.superwall.sdk:superwall-android:2.7.3"
    ```
  </Tab>

  <Tab value="build.gradle.kts">
    ```kotlin build.gradle.kts
    implementation("com.superwall.sdk:superwall-android:2.7.3")
    ```
  </Tab>

  <Tab value="libs.version.toml">
    ```toml libs.version.toml
    [libraries]
    superwall-android = { group = "com.superwall.sdk", name = "superwall-android", version = "2.7.3" }

    // And in your build.gradle.kts
    dependencies {
        implementation(libs.superwall.android)
    }
    ```
  </Tab>
</Tabs>

Make sure to run **Sync Now** to force Android Studio to update.

<Frame>![](/images/installation/gradle-sync-now.png) </Frame>

<br />

Go to your `AndroidManifest.xml` and add the following permissions:

<Frame>![](/images/installation/manifest-permissions.png)</Frame>

```xml AndroidManifest.xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="com.android.vending.BILLING" />
```

Then add our Activity to your `AndroidManifest.xml`:

<Frame>![](/images/installation/manifest-activity.png)</Frame>

```xml AndroidManifest.xml
<activity
  android:name="com.superwall.sdk.paywall.view.SuperwallPaywallActivity"
  android:theme="@style/Theme.MaterialComponents.DayNight.NoActionBar"
  android:configChanges="orientation|screenSize|keyboardHidden">
</activity>
<activity android:name="com.superwall.sdk.debug.DebugViewActivity" />
<activity android:name="com.superwall.sdk.debug.localizations.SWLocalizationActivity" />
<activity android:name="com.superwall.sdk.debug.SWConsoleActivity" />
```

Set your app's theme in the `android:theme` section.

When choosing a device or emulator to run on make sure that it has the Play Store app and that you are signed in to your Google account on the Play Store.

<Check>**And you're done!** Now you're ready to configure the SDK 👇</Check>

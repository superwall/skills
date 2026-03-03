# Install the SDK
Source: https://superwall.com/docs/expo/quickstart/install

Install the Superwall React Native SDK via your favorite package manager.

This guide is for Expo projects that want to integrate Superwall using our Expo SDK.

<Note>
  **This doesn't sound like you?**

  * **React Native app, new to Superwall** → See our [installation guide for bare React Native apps](/expo/guides/using-expo-sdk-in-bare-react-native)
  * **React Native app with existing Superwall SDK** → See our [migration guide](/expo/guides/migrating-react-native)
</Note>

<Warning>
  **Important: Expo SDK 53+ Required**

  This SDK is exclusively compatible with Expo SDK version 53 and newer. For projects using older Expo versions, please use our [legacy React Native SDK](https://github.com/superwall/react-native-superwall).
</Warning>

<Warning>
  **Expo Go is Not Supported**

  The Superwall SDK uses native modules that are not available in Expo Go. You must use an [Expo Development Build](https://docs.expo.dev/develop/development-builds/introduction/) to run your app with Superwall.

  To create a development build:

  ```bash
  npx expo run:ios
  # or
  npx expo run:android
  ```

  If you see the error `Cannot find native module 'SuperwallExpo'`, see our [Debugging guide](/expo/guides/debugging) for solutions.
</Warning>

To see the latest release, check out the [Superwall Expo SDK repo](https://github.com/superwall/expo-superwall).

<Tabs items={["bun","pnpm","npm","yarn"]} groupId="language" persist>
  <Tab value="bun">
    ```bash bun
    bunx expo install expo-superwall
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash pnpm
    pnpm dlx expo install expo-superwall
    ```
  </Tab>

  <Tab value="npm">
    ```bash npm
    npx expo install expo-superwall
    ```
  </Tab>

  <Tab value="yarn">
    ```bash yarn
    yarn dlx expo install expo-superwall
    ```
  </Tab>
</Tabs>

## Version Targeting

<Warning>Superwall requires iOS 15.1 or higher, as well as Android SDK 21 or higher. Ensure your Expo project targets the correct minimum OS version by updating app.json or app.config.js.</Warning>

First, install the `expo-build-properties` config plugin if your Expo project hasn’t yet:

```bash
npx expo install expo-build-properties
```

Then, add the following to your `app.json` or `app.config.js` file:

```json
{
  "expo": {
    "plugins": [
      ...
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 21
          },
          "ios": {
              "deploymentTarget": "15.1" // or higher
          }
        }
      ]
    ]
  }
}
```

<Check>**And you're done!** Now you're ready to configure the SDK </Check>

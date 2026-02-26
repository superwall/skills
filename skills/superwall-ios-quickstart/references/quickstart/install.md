# Install the SDK
Source: https://superwall.com/docs/ios/quickstart/install

<Tip>
  Visual learner? Go watch our install video over on YouTube
  [here](https://youtu.be/geTHOGyL_60).
</Tip>

## Overview

To see the latest release, [check out the repository](https://github.com/superwall/Superwall-iOS).

You can install via [Swift Package Manager](#install-via-swift-package-manager) or [CocoaPods](#install-via-cocoapods).

## Install via Swift Package Manager

[Swift Package Manager](https://swift.org/package-manager/) is a tool for automating the distribution of Swift code and is integrated into the Swift compiler.

In **Xcode**, select **File ▸ Add Packages...**:

<Frame>
  ![1174](/images/dd4b1e2-Screenshot_2022-03-21_at_11.26.05.png "Screenshot 2022-03-21 at
  11.26.05.png"){" "}
</Frame>

**Then, paste the GitHub repository URL:**

```
https://github.com/superwall/Superwall-iOS
```

in the search bar. With the **Superwall-iOS** source selected, set the **Dependency Rule** to **Up to Next Major Version** with the lower bound set to **4.0.0**. Make sure your project name is selected in **Add to Project**. Then click **Add Package**:

<Frame>![](/images/somLatest.png)</Frame>

After the package has loaded, make sure **Add to Target** is set to your app's name and click **Add Package**:

<Frame>![](/images/5ab25c4-Screenshot_2023-01-31_at_16.56.22.png) </Frame>

<br />

<Check>**And you're done!** Now you're ready to configure the SDK 👇</Check>

## Install via CocoaPods

First, add the following to your Podfile:

`pod 'SuperwallKit', '< 5.0.0'
`

Next, run `pod repo update` to update your local spec repo. [Why?](https://stackoverflow.com/questions/43701352/what-exactly-does-pod-repo-update-do).

Finally, run `pod install` from your terminal. Note that in your target's **Build Settings -> User Script Sandboxing**, this value should be set to **No**.

### Updating to a New Release

To update to a new beta release, you'll need to update the version specified in the Podfile and then run `pod install` again.

### Import SuperwallKit

You should now be able to `import SuperwallKit`:

<Tabs items={["Swift","Objective-C"]} groupId="language" persist>
  <Tab value="Swift">
    ```swift Swift
    import SuperwallKit
    ```
  </Tab>

  <Tab value="Objective-C">
    ```swift Objective-C
    @import SuperwallKit;
    ```
  </Tab>
</Tabs>

<Check>**And you're done!** Now you're ready to configure the SDK 👇</Check>

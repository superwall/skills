# Tracking Subscription State
Source: https://superwall.com/docs/android/quickstart/tracking-subscription-state

Here's how to view whether or not a user is on a paid plan in Android.

Superwall tracks the subscription state of a user for you. However, there are times in your app where you need to know if a user is on a paid plan or not. For example, you might want to conditionally show certain UI elements or enable premium features based on their subscription status.

## Using subscriptionStatus

The easiest way to track subscription status in Android is by accessing the `subscriptionStatus` StateFlow:

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Get current status
        val status = Superwall.instance.subscriptionStatus.value
        when (status) {
            is SubscriptionStatus.Active -> {
                Log.d("Superwall", "User has active entitlements: ${status.entitlements}")
                showPremiumContent()
            }
            is SubscriptionStatus.Inactive -> {
                Log.d("Superwall", "User is on free plan")
                showFreeContent()
            }
            is SubscriptionStatus.Unknown -> {
                Log.d("Superwall", "Subscription status unknown")
                showLoadingState()
            }
        }
    }
}
```

The `SubscriptionStatus` sealed class has three possible states:

* `SubscriptionStatus.Unknown` - Status is not yet determined
* `SubscriptionStatus.Active(Set<String>)` - User has active entitlements (set of entitlement identifiers)
* `SubscriptionStatus.Inactive` - User has no active entitlements

## Observing subscription status changes

You can observe real-time subscription status changes using Kotlin's StateFlow:

```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        lifecycleScope.launch {
            Superwall.instance.subscriptionStatus.collect { status ->
                when (status) {
                    is SubscriptionStatus.Active -> {
                        Log.d("Superwall", "User upgraded to pro!")
                        updateUiForPremiumUser()
                    }
                    is SubscriptionStatus.Inactive -> {
                        Log.d("Superwall", "User is on free plan")
                        updateUiForFreeUser()
                    }
                    is SubscriptionStatus.Unknown -> {
                        Log.d("Superwall", "Loading subscription status...")
                        showLoadingState()
                    }
                }
            }
        }
    }
}
```

## Using with Jetpack Compose

If you're using Jetpack Compose, you can observe subscription status reactively:

```kotlin
@Composable
fun ContentScreen() {
    val subscriptionStatus by Superwall.instance.subscriptionStatus
        .collectAsState()
    
    Column {
        when (subscriptionStatus) {
            is SubscriptionStatus.Active -> {
                val entitlements = (subscriptionStatus as SubscriptionStatus.Active).entitlements
                Text("Premium user with: ${entitlements.joinToString()}")
                PremiumContent()
            }
            is SubscriptionStatus.Inactive -> {
                Text("Free user")
                FreeContent()
            }
            is SubscriptionStatus.Unknown -> {
                Text("Loading...")
                LoadingIndicator()
            }
        }
    }
}
```

## Reading detailed purchase history (2.6.6+)

When you need more context than `SubscriptionStatus` provides (for example, to show the full transaction history or mix web redemptions with Google Play receipts), subscribe to `Superwall.instance.customerInfo`. The flow emits a `CustomerInfo` object that merges device, web, and external purchase controller data.

```kotlin
class BillingDashboardFragment : Fragment() {

  override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    viewLifecycleOwner.lifecycleScope.launch {
      Superwall.instance.customerInfo.collect { info ->
        val subscriptions = info.subscriptions.map { it.productId to it.expiresDate }
        val nonSubscriptions = info.nonSubscriptions.map { it.productId to it.purchaseDate }
        val entitlementIds = info.entitlements.filter { it.isActive }.map { it.id }

        renderCustomerInfo(
          activeProducts = info.activeSubscriptionProductIds,
          entitlements = entitlementIds,
          subscriptions = subscriptions,
          oneTimePurchases = nonSubscriptions
        )
      }
    }
  }
}
```

Need the latest value immediately (for example, during cold start)? Call `Superwall.instance.getCustomerInfo()` to synchronously read the most recent snapshot before collecting the flow:

```kotlin
val cached = Superwall.instance.getCustomerInfo()
renderCustomerInfo(
  activeProducts = cached.activeSubscriptionProductIds,
  entitlements = cached.entitlements.filter { it.isActive }.map { it.id },
  subscriptions = cached.subscriptions.map { it.productId to it.purchaseDate },
  oneTimePurchases = cached.nonSubscriptions.map { it.productId to it.purchaseDate }
)
```

After you start collecting, you can also watch for [`SuperwallDelegate.customerInfoDidChange(from:to:)`](/android/sdk-reference/SuperwallDelegate#customerinfodidchangefrom-customerinfo-to-customerinfo) to run analytics or sync other systems whenever purchases change.

## Checking for specific entitlements

If your app has multiple subscription tiers (e.g., Bronze, Silver, Gold), you can check for specific entitlements:

```kotlin
val status = Superwall.instance.subscriptionStatus.value
when (status) {
    is SubscriptionStatus.Active -> {
        if (status.entitlements.contains("gold")) {
            // Show gold-tier features
            showGoldFeatures()
        } else if (status.entitlements.contains("silver")) {
            // Show silver-tier features
            showSilverFeatures()
        }
    }
    else -> showFreeFeatures()
}
```

## Setting subscription status

When using Superwall with a custom purchase controller or third-party billing service, you need to manually update the subscription status. Here's how to sync with RevenueCat:

```kotlin
class RevenueCatPurchaseController : PurchaseController {
    
    override suspend fun purchase(
        activity: Activity,
        product: StoreProduct
    ): PurchaseResult {
        return try {
            val result = Purchases.sharedInstance.purchase(activity, product.sku)
            
            // Update Superwall subscription status based on RevenueCat result
            if (result.isSuccessful) {
                val entitlements = result.customerInfo.entitlements.active.keys
                Superwall.instance.setSubscriptionStatus(
                    SubscriptionStatus.Active(entitlements)
                )
                PurchaseResult.Purchased
            } else {
                PurchaseResult.Failed(Exception("Purchase failed"))
            }
        } catch (e: Exception) {
            PurchaseResult.Failed(e)
        }
    }
    
    override suspend fun restorePurchases(): RestorationResult {
        return try {
            val customerInfo = Purchases.sharedInstance.restorePurchases()
            val activeEntitlements = customerInfo.entitlements.active.keys
            
            if (activeEntitlements.isNotEmpty()) {
                Superwall.instance.setSubscriptionStatus(
                    SubscriptionStatus.Active(activeEntitlements)
                )
            } else {
                Superwall.instance.setSubscriptionStatus(SubscriptionStatus.Inactive)
            }
            
            RestorationResult.Restored
        } catch (e: Exception) {
            RestorationResult.Failed(e)
        }
    }
}
```

You can also listen for subscription changes from your billing service:

```kotlin
class SubscriptionManager {
    
    fun syncSubscriptionStatus() {
        Purchases.sharedInstance.getCustomerInfoWith { customerInfo ->
            val activeEntitlements = customerInfo.entitlements.active.keys
            
            if (activeEntitlements.isNotEmpty()) {
                Superwall.instance.setSubscriptionStatus(
                    SubscriptionStatus.Active(activeEntitlements)
                )
            } else {
                Superwall.instance.setSubscriptionStatus(SubscriptionStatus.Inactive)
            }
        }
    }
}
```

## Using SuperwallDelegate

You can also listen for subscription status changes using the `SuperwallDelegate`:

```kotlin
class MyApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        Superwall.configure(
            applicationContext = this,
            apiKey = "YOUR_API_KEY",
            options = SuperwallOptions().apply {
                delegate = object : SuperwallDelegate() {
                    override fun subscriptionStatusDidChange(
                        from: SubscriptionStatus,
                        to: SubscriptionStatus
                    ) {
                        when (to) {
                            is SubscriptionStatus.Active -> {
                                Log.d("Superwall", "User is now premium")
                            }
                            is SubscriptionStatus.Inactive -> {
                                Log.d("Superwall", "User is now free")
                            }
                            is SubscriptionStatus.Unknown -> {
                                Log.d("Superwall", "Status unknown")
                            }
                        }
                    }
                }
            }
        )
    }
}
```

## Superwall checks subscription status for you

Remember that the Superwall SDK uses its [audience filters](/campaigns-audience#matching-to-entitlements) for determining when to show paywalls. You generally don't need to wrap your calls to register placements with subscription status checks:

```kotlin
// ❌ Unnecessary
if (Superwall.instance.subscriptionStatus.value !is SubscriptionStatus.Active) {
    Superwall.instance.register("campaign_trigger")
}

// ✅ Just register the placement
Superwall.instance.register("campaign_trigger")
```

In your [audience filters](/campaigns-audience#matching-to-entitlements), you can specify whether the subscription state should be considered, which keeps your codebase cleaner and puts the "Should this paywall show?" logic where it belongs—in the Superwall dashboard.

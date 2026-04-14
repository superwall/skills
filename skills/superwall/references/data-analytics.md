## Data & Analytics - Superwall ClickHouse Data Warehouse — Master Documentation

The Superwall CLI/API lets you run queries against Superwall's live production clickhouse database. Under the hood, Superwall proxies authenticated API requests to ClickHouse's hosted http endpoint, authenticating for you. the data:read scope is required. Superwall manages credentials internally for customers and uses RLS for safety.

#### Execution Environment

```bash
./sw-api.sh -m POST -d 'SELECT * FROM table FORMAT CSVWithNames' /v2/organizations/:organizationId/query
```

#### Critical Constraints

- **READ-ONLY OPERATIONS ONLY.** No DDL/DML. SELECT queries only.
- **~86GB cluster memory limit** — always filter by `applicationId` first to avoid OOM.
- **Filter `ts < now()`** — some tables contain future timestamps (e.g. events_hr_agg has data up to 2038).
- **Never query `sw.events_rep` unless all of these are true**:
  - filter by `applicationId`
  - restrict `ts` to a bounded window no longer than 7 days using both `ts > toStartOfHour(now() - INTERVAL ...)` and `ts < now()`
  - never use `FINAL`
- Use `uniq(id)` instead of `count(distinct id)` for better performance.
- Parse JSON with `JSONExtractString()`, `JSONExtractInt()`, `JSONExtractKeys()` etc.
- Always run `SHOW CREATE TABLE` before querying unfamiliar tables.
- Sample data first — `meta`, `props`, `headers`, `debug` columns contain JSON strings.

---

#### Table Overview

| Table                                      | Engine                     | Purpose                                                      | Scale                                   |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| `sw.applications_rep`                      | SharedReplacingMergeTree   | App registry — maps applicationId to name/platform           | ~37.5K apps                             |
| `sw.demand_score_events_rep`               | SharedReplacingMergeTree   | Events enriched with demand (purchase intent) scores         | Billions of rows                        |
| `sw.events_hr_agg`                         | SharedAggregatingMergeTree | Hourly pre-aggregated event counts                           | Billions of aggregate rows              |
| `sw.events_rep`                            | SharedReplacingMergeTree   | **Raw event firehose** — every SDK event                     | Massive (billions). Use as last resort. |
| `sw.subscription_status_rep`               | SharedReplacingMergeTree   | Latest subscription status per user per app                  | One row per user (after FINAL)          |
| `sw.user_attributes_rep`                   | SharedReplacingMergeTree   | Key-value user attributes                                    | Tens of millions per app                |
| `open_revenue.attributed_events_by_ts_rep` | SharedReplacingMergeTree   | Revenue attribution — subscriptions, renewals, cancellations | Millions per app                        |
| `open_revenue.paywall_open_events_agg`     | SharedAggregatingMergeTree | Lifetime paywall open counts by experiment/variant/placement | ~490K rows, 9.9K apps                   |

---

#### ReplacingMergeTree vs AggregatingMergeTree

- **ReplacingMergeTree** (`_rep` suffix): Deduplicates rows by ORDER BY key. Use `FINAL` when you need read-time deduplication, except on `sw.events_rep` where `FINAL` must never be used. Tables with `isDeleted` column — filter `isDeleted=0`.
- **AggregatingMergeTree** (`_agg` or `_hr_agg` suffix): Stores pre-aggregated states. Use `-Merge` combinators to read (e.g., `uniqMerge(count)`). **Never nest aggregate functions** — `sum(uniqMerge(x))` is illegal; use subqueries instead.

---

### 1. `sw.applications_rep`

#### Purpose

App registry. Maps `applicationId` (Int32) to app name and platform.

#### Schema

```sql
CREATE TABLE sw.applications_rep
(
    `applicationId` Int32,
    `name` String,
    `platform` LowCardinality(String),
    `isDeleted` UInt8,
    `insertedAt` DateTime64(6, 'UTC') DEFAULT now64()
)
ENGINE = SharedReplacingMergeTree(insertedAt, isDeleted)
ORDER BY applicationId
SETTINGS index_granularity = 512
```

#### Key Details

- **ORDER BY**: `applicationId` — direct lookups are fast
- **No PARTITION** — small table, no partitioning needed
- **isDeleted**: Soft-delete flag. Currently 0 deleted apps exist (all 37,563 are active)
- **Platform values and counts**:
  - `IOS`: 25,027
  - `ANDROID`: 10,967
  - `STRIPE`: 983
  - `PROMOTIONAL`: 327
  - `WEB`: 231
  - `PADDLE`: 28

#### Multi-Platform App Pattern

An organization can have the same app across platforms — each gets its own `applicationId`. When an iOS app has Stripe checkout paywalls, `paywall_open` events happen on the iOS `applicationId` but revenue flows through the STRIPE `applicationId`. Link via `appUserId` or `attributionProps.paywallId`.

#### Vetted Queries

```sql
-- Find an app by name
SELECT applicationId, name, platform
FROM sw.applications_rep FINAL
WHERE name ILIKE '%fitness%' AND isDeleted=0
ORDER BY applicationId
LIMIT 20
```

```sql
-- Platform breakdown
SELECT platform, count() as cnt
FROM sw.applications_rep FINAL
WHERE isDeleted=0
GROUP BY platform ORDER BY cnt DESC
```

---

### 2. `sw.events_rep`

#### Purpose

**Raw event firehose.** Every SDK event from every app. Massive table (billions of rows). Use as a last resort — prefer aggregated tables (`events_hr_agg`, `sdk_events_agg`) when possible.

#### Hard Query Guardrails

- Query `sw.events_rep` only when all of these are true:
  - `WHERE applicationId = ...`
  - `ts > toStartOfHour(now() - INTERVAL ... ) AND ts < now()`
  - the time window is no longer than 7 days, including "last 7d" queries
- Never use `FINAL` on `sw.events_rep`
- If those conditions cannot be met, use an aggregated table or a different source instead

#### Schema

```sql
CREATE TABLE sw.events_rep
(
    `id` String CODEC(ZSTD(1)),
    `appUserId` String CODEC(ZSTD(1)),
    `applicationId` UInt32,
    `name` LowCardinality(String),
    `meta` String CODEC(ZSTD(3)),
    `props` String CODEC(ZSTD(3)),
    `headers` String CODEC(ZSTD(3)),
    `debug` String CODEC(ZSTD(3)),
    `isSandbox` UInt8,
    `ts` DateTime64(6, 'UTC') CODEC(ZSTD(1)),
    `insertedAt` DateTime64(6, 'UTC') DEFAULT now64(),
    `isDeleted` UInt8 DEFAULT 0
)
ENGINE = SharedReplacingMergeTree(insertedAt, isDeleted)
PARTITION BY toYYYYMM(ts)
PRIMARY KEY (applicationId, isSandbox, toStartOfHour(ts), name, appUserId, id)
ORDER BY (applicationId, isSandbox, toStartOfHour(ts), name, appUserId, id, ts)
SETTINGS index_granularity = 8192
```

#### Key Details

- **PARTITION BY**: `toYYYYMM(ts)` — monthly partitions
- **PRIMARY KEY** includes `applicationId, isSandbox, toStartOfHour(ts), name` — always filter on these for performance
- **Mandatory filters**: `applicationId` and a bounded `ts` range no longer than 7 days, with both a lower bound and `ts < now()`
- **JSON columns**: `meta`, `props`, `headers`, `debug` are all JSON strings

#### `meta` JSON Keys

`aliases`, `apiKey`, `appInstallDate`, `appUserId`, `appVersion`, `applicationId`, `bundleId`, `cfg`, `deviceCurrencyCode`, `deviceCurrencySymbol`, `deviceLanguageCode`, `deviceLocale`, `deviceModel`, `headerParsingVersion`, `interfaceStyle`, `isLowPowerModeEnabled`, `isSandbox`, `organizationId`, `osVersion`, `outcome`, `platform`, `platformEnvironment`, `platformWrapper`, `projectId`, `radioType`, `receivedAt`, `remoteIp`, `requestCurrentTime`, `requestId`, `requestPath`, `requestRetryCount`, `requestUserAgent`, `requestVerb`, `sdkVersion`, `sha`, `source`, `srv`, `staticConfigBuildId`, `subscriptionStatus`, `timezoneOffset`, `urlScheme`, `vendorId`

#### `props` JSON Keys (varies by event name)

**For `paywall_open`**: `$app_session_id`, `$build_id`, `$cache_key`, `$close_reason`, `$event_name`, `$experiment_id`, `$feature_gating`, `$is_free_trial_available`, `$is_scroll_enabled`, `$is_standard_event`, `$paywall_id`, `$paywall_identifier`, `$paywall_name`, `$paywall_product_ids`, `$paywall_products_load_*` (timing fields), `$paywall_response_load_*`, `$paywall_url`, `$paywall_webview_load_*`, `$paywalljs_version`, `$presentation_source_type`, `$presented_by`, `$presented_by_event_id`, `$presented_by_event_name`, `$presented_by_event_timestamp`, `$primary_product_id`, `$secondary_product_id`, `$tertiary_product_id`, `$trigger_session_id`, `$variant_id`, `event_name`, `paywall_id`, `paywall_name`

**For `config_attributes`**: `$app_session_id`, `$automaticallyDismiss`, `$event_name`, `$has_delegate`, `$isExternalDataCollectionEnabled`, `$isGameControllerEnabled`, `$isHapticFeedbackEnabled`, `$is_standard_event`, `$localeIdentifier`, `$logLevel`, `$networkEnvironment`, `$restoreCloseButtonTitle`, `$restoreMessage`, `$restoreTitle`, `$shouldPreload`, `$shouldShowPurchaseFailureAlert`, `$transactionBackgroundView`, `$using_purchase_controller`, `event_name`

**For `transaction_complete`**: All `paywall_open` fields plus: `$product_*` (price, period, currency, trial info), `$source`, `$store`, `$storefront_countryCode`, `$storefront_id`, `$storekit_version`, `$transaction_type`

#### Common Event Names (from app 1 over 7 days, ordered by volume)

- `user_attributes` (310K), `logged_set` (290K), `app_open` (289K), `opened_application` (285K), `app_close` (267K)
- `paywallWebviewLoad_timeout` (117K), `trigger_fire` (88K), `config_attributes` (84K)
- `session_start` (45K), `device_attributes` (44K), `app_launch` (43K)
- `paywall_open`, `paywall_close`, `paywall_decline`, `transaction_start`, `transaction_complete`, `transaction_abandon`, `transaction_fail`
- App-specific custom events (e.g. `logged_set`, `start_workout`, `equipment_tap`)

#### Standard Superwall Events

These are system events emitted by the SDK:

- **Lifecycle**: `first_seen`, `app_install`, `app_open`, `app_close`, `app_launch`, `session_start`
- **Paywall**: `paywall_open`, `paywall_close`, `paywall_decline`, `paywall_show`, `trigger_fire`, `paywallPresentationRequest`
- **Transaction**: `transaction_start`, `transaction_complete`, `transaction_abandon`, `transaction_fail`, `transaction_restore`
- **Config**: `config_attributes`, `config_refresh`
- **Identity**: `identity_alias`, `subscriber_alias`, `user_attributes`, `device_attributes`
- **Subscription**: `subscriptionStatus_didChange`
- **Loading**: `paywallWebviewLoad_start/complete/timeout/fail`, `paywallResponseLoad_start/complete/fail`, `paywallProductsLoad_start/complete/fail/retry`

#### Vetted Queries

```sql
-- Check SDK configuration (purchase controller, StoreKit version)
SELECT props
FROM sw.events_rep
WHERE applicationId = {app_id}
  AND name = 'config_attributes'
  AND ts > toStartOfHour(now() - INTERVAL 1 HOUR) AND ts < now()
LIMIT 1
```

**Key fields in config_attributes props:**

- `$using_purchase_controller` — `true` = app handles purchases itself
- `$shouldObservePurchases` — `true` = Superwall listens for StoreKit transactions independently (only in some SDK versions)
- `$has_delegate` — whether a delegate is set

**Diagnosing missing revenue:** When `using_purchase_controller=true` and no `shouldObservePurchases`, Superwall relies entirely on the app to report purchase results.

```sql
-- Recent event volume by name for an app
SELECT name, count() as cnt
FROM sw.events_rep
WHERE applicationId = {app_id} AND isSandbox = 0
  AND ts > toStartOfHour(now() - INTERVAL 7 DAY) AND ts < now()
GROUP BY name ORDER BY cnt DESC LIMIT 30
```

---

### 3. `sw.demand_score_events_rep`

#### Purpose

A subset of events enriched with **demand scores** — a 0-100 score predicting purchase intent. Structurally identical to `events_rep` but adds `demandScore`, `sessionId`, and an `appInstallDate` materialized column. Contains `device_attributes`, `paywall_open`, and `transaction_complete` events.

#### Schema

```sql
CREATE TABLE sw.demand_score_events_rep
(
    `id` String CODEC(ZSTD(1)),
    `appUserId` String CODEC(ZSTD(1)),
    `applicationId` UInt32,
    `name` LowCardinality(String),
    `meta` String CODEC(ZSTD(3)),
    `props` String CODEC(ZSTD(3)),
    `headers` String CODEC(ZSTD(3)),
    `debug` String CODEC(ZSTD(3)),
    `isSandbox` UInt8,
    `ts` DateTime64(6, 'UTC') CODEC(ZSTD(1)),
    `insertedAt` DateTime64(6, 'UTC') DEFAULT now64(),
    `isDeleted` UInt8 DEFAULT 0,
    `demandScore` Int64 DEFAULT -1,
    `sessionId` String CODEC(ZSTD(1)),
    `appInstallDate` Nullable(DateTime64(6, 'UTC'))
        MATERIALIZED parseDateTime64BestEffortOrNull(JSONExtractString(meta, 'appInstallDate'), 6, 'UTC'),
    PROJECTION installs_by_demand_score (
        SELECT * ORDER BY isSandbox, name, appInstallDate, demandScore
    )
)
ENGINE = SharedReplacingMergeTree(insertedAt, isDeleted)
PARTITION BY toYYYYMM(ts)
PRIMARY KEY (applicationId, isSandbox, toStartOfHour(ts), sessionId, id)
ORDER BY (applicationId, isSandbox, toStartOfHour(ts), sessionId, id, ts)
SETTINGS index_granularity = 8192
```

#### Key Details

- **demandScore**: Int64, range 1-100 when populated, `-1` when not scored. Not all apps have scoring enabled.
- **Event names in this table**: `device_attributes` (vast majority), `paywall_open`, `transaction_complete`
- **sessionId**: Groups events within a single user session
- **appInstallDate**: Materialized from `meta.appInstallDate` JSON — allows cohort analysis
- **PROJECTION** `installs_by_demand_score`: Optimized for queries filtering by `isSandbox, name, appInstallDate, demandScore`
- **meta JSON keys**: Same as `events_rep`

#### Demand Score Distribution (from app 16022, 7-day window)

- Range: 1-100 (scores of 0 do not occur)
- Mean: ~47, Median (p50): 47, P95: 81
- Distribution is roughly bell-shaped, centered around 45-55
- Higher scores predict trial starts but inversely correlate with trial-to-paid conversion

#### Vetted Queries

```sql
-- Demand score distribution for an app
SELECT demandScore, count() as cnt
FROM sw.demand_score_events_rep
WHERE applicationId = {app_id} AND isSandbox = 0
  AND ts >= now() - INTERVAL 30 DAY AND demandScore >= 0
GROUP BY demandScore ORDER BY demandScore
```

```sql
-- Demand score stats by event name
SELECT name,
  avg(demandScore) as avg,
  quantile(0.5)(demandScore) as p50,
  quantile(0.95)(demandScore) as p95
FROM sw.demand_score_events_rep
WHERE applicationId = {app_id} AND isSandbox = 0
  AND ts >= now() - INTERVAL 7 DAY AND demandScore >= 0
GROUP BY name
```

---

### 4. `sw.events_hr_agg`

#### Purpose

**Hourly pre-aggregated event counts.** Stores unique event counts per hour, per app, per event name, per source. Much lighter than querying `events_rep` directly for volume/trend analysis.

#### Schema

```sql
CREATE TABLE sw.events_hr_agg
(
    `ts` DateTime64(6, 'UTC'),
    `name` LowCardinality(String) CODEC(ZSTD(1)),
    `source` LowCardinality(String) CODEC(ZSTD(1)),
    `applicationId` UInt64,
    `isSandbox` UInt8,
    `count` AggregateFunction(uniq, String),
    `recentEvents` AggregateFunction(groupArraySorted(250), Tuple(
        Int64, String, UInt32, String,
        DateTime64(6, 'UTC'), DateTime64(6, 'UTC'),
        String, String))
)
ENGINE = SharedAggregatingMergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (applicationId, isSandbox, name, ts)
SETTINGS index_granularity = 512
```

#### Key Details

- **AggregatingMergeTree** — use `-Merge` combinators: `uniqMerge(count)` for unique event counts
- **`source` values**: `sdk` (events from the Superwall SDK), `integration` (events from integration partners like RevenueCat)
- **`count`**: `AggregateFunction(uniq, String)` — stores HyperLogLog state for unique event IDs. Read with `uniqMerge(count)`.
- **`recentEvents`**: Stores up to 250 recent events per bucket as sorted tuples. Read with `groupArraySortedMerge(250)(recentEvents)`.
- **Time range**: Data from 2024-09-26 through 2038-01-01 (future timestamps exist — always filter `ts < now()`)
- **Event names**: Hundreds — includes all standard Superwall events plus app-specific custom events
- **Cannot nest aggregate calls**: `sum(uniqMerge(count))` is illegal. Use a subquery:

```sql
-- WRONG: sum(uniqMerge(count))
-- RIGHT: Use subquery
SELECT name, sum(hourly_uniques) as total
FROM (
    SELECT name, ts, uniqMerge(count) as hourly_uniques
    FROM sw.events_hr_agg
    WHERE applicationId = {app_id} AND isSandbox = 0
      AND ts >= now() - INTERVAL 7 DAY AND ts < now()
    GROUP BY name, ts
) GROUP BY name ORDER BY total DESC
```

#### Vetted Queries

```sql
-- Hourly unique event count for an app (recent)
SELECT ts, name, source, uniqMerge(count) as unique_events
FROM sw.events_hr_agg
WHERE applicationId = {app_id} AND isSandbox = 0
  AND ts >= now() - INTERVAL 2 DAY AND ts < now()
GROUP BY ts, name, source
ORDER BY ts DESC LIMIT 20
```

```sql
-- Check if an app is sending events (last 5 minutes proxy: check last hour)
SELECT name, uniqMerge(count) as cnt
FROM sw.events_hr_agg
WHERE applicationId = {app_id} AND isSandbox = 0
  AND ts >= now() - INTERVAL 1 HOUR AND ts < now()
GROUP BY name ORDER BY cnt DESC
```

---

### 5. `sw.subscription_status_rep`

#### Purpose

**Latest subscription status per user per app.** One row per `(applicationId, appUserId, isSandbox)` after `FINAL`. The `name` column always contains `subscriptionStatus_didChange`. The actual status (`ACTIVE`/`INACTIVE`) is in the `props` JSON.

#### Schema

```sql
CREATE TABLE sw.subscription_status_rep
(
    `id` String CODEC(ZSTD(1)),
    `appUserId` String CODEC(ZSTD(1)),
    `applicationId` UInt32,
    `name` LowCardinality(String),
    `meta` String CODEC(ZSTD(3)),
    `props` String CODEC(ZSTD(3)),
    `headers` String CODEC(ZSTD(3)),
    `debug` String CODEC(ZSTD(3)),
    `isSandbox` UInt8,
    `ts` DateTime64(6, 'UTC') CODEC(ZSTD(1)),
    `insertedAt` DateTime64(6, 'UTC') DEFAULT now64(),
    `isDeleted` UInt8 DEFAULT 0
)
ENGINE = SharedReplacingMergeTree(insertedAt, isDeleted)
ORDER BY (applicationId, appUserId, isSandbox)
SETTINGS index_granularity = 8192
```

#### Key Details

- **ORDER BY**: `(applicationId, appUserId, isSandbox)` — one row per user after FINAL (latest status wins)
- **No PARTITION** — not partitioned by time
- **name** column: Always `subscriptionStatus_didChange`
- **Subscription status** is in `props.$subscription_status`: values are `ACTIVE` or `INACTIVE`
- **Status distribution** (app 1): 251,682 INACTIVE, 29,846 ACTIVE (~10.6% active)
- **Always use FINAL** and filter `isDeleted=0`

#### Vetted Queries

```sql
-- Subscription status distribution for an app
SELECT
  JSONExtractString(props, '$subscription_status') as status,
  count() as cnt
FROM sw.subscription_status_rep FINAL
WHERE applicationId = {app_id} AND isSandbox = 0 AND isDeleted = 0
GROUP BY status ORDER BY cnt DESC
```

```sql
-- Check a specific user's subscription status
SELECT appUserId,
  JSONExtractString(props, '$subscription_status') as status,
  ts
FROM sw.subscription_status_rep FINAL
WHERE applicationId = {app_id} AND appUserId = '{user_id}' AND isSandbox = 0
```

```sql
-- Count active subscribers
SELECT count() as active_subscribers
FROM sw.subscription_status_rep FINAL
WHERE applicationId = {app_id} AND isSandbox = 0 AND isDeleted = 0
  AND JSONExtractString(props, '$subscription_status') = 'ACTIVE'
```

---

### 6. `sw.user_attributes_rep`

#### Purpose

**Key-value user attributes.** Each row is one attribute for one user. Easier than parsing JSON from `events_rep` for user segmentation. Stores custom attributes set by the app and some system attributes.

#### Schema

```sql
CREATE TABLE sw.user_attributes_rep
(
    `appUserId` String CODEC(ZSTD(1)),
    `key` LowCardinality(String) CODEC(ZSTD(3)),
    `type` LowCardinality(String) CODEC(ZSTD(3)),
    `value` String CODEC(ZSTD(1)),
    `applicationId` UInt64,
    `isSandbox` UInt8,
    `isDeleted` UInt8,
    `ts` DateTime64(6, 'UTC'),
    `jsType` LowCardinality(String)
        MATERIALIZED multiIf(
            position(lower(type), 'int') != 0, 'number',
            position(lower(type), 'double') != 0, 'number',
            position(lower(type), 'string') != 0, 'string',
            position(lower(type), 'object') != 0, 'object',
            position(lower(type), 'array') != 0, 'array',
            position(lower(type), 'null') != 0, 'null',
            position(lower(type), 'bool') != 0, 'boolean',
            'string')
)
ENGINE = SharedReplacingMergeTree(ts, isDeleted)
ORDER BY (applicationId, isSandbox, appUserId, key)
SETTINGS index_granularity = 512
```

#### Key Details

- **ORDER BY**: `(applicationId, isSandbox, appUserId, key)` — one row per user per key after FINAL
- **Version column**: `ts` (not `insertedAt`) — latest timestamp wins in ReplacingMergeTree
- **isDeleted**: Soft-delete flag. Filter `isDeleted=0`.
- **type values**: `String` (17M), `Bool` (15M), `Int64` (11M), `Double` (2M), `Null` (7K), `UInt64` (1)
- **jsType**: Materialized column normalizing `type` → JavaScript types (`number`, `string`, `boolean`, `object`, `array`, `null`)

#### Common Attribute Keys (app 1)

System attributes (prefixed with `$`): `$application_installed_at`, `$app_session_id`
App-specific: `first_name`, `created_at`, `subscription_canceled`, `apns_token`, `email`, `age`, `seed`, `aliasId`, `paying_user`, `uses_metric_units`, `defaultEquipment`, `routine`, `audio_queues`, etc.

#### Vetted Queries

```sql
-- Get all attributes for a specific user
SELECT key, type, value, ts
FROM sw.user_attributes_rep FINAL
WHERE applicationId = {app_id} AND isSandbox = 0
  AND appUserId = '{user_id}' AND isDeleted = 0
ORDER BY key
```

```sql
-- List available attribute keys for an app
SELECT key, count() as user_count, any(type) as sample_type
FROM sw.user_attributes_rep FINAL
WHERE applicationId = {app_id} AND isSandbox = 0 AND isDeleted = 0
GROUP BY key ORDER BY user_count DESC LIMIT 30
```

```sql
-- Segment users by an attribute value
SELECT value as subscription_status, uniq(appUserId) as users
FROM sw.user_attributes_rep FINAL
WHERE applicationId = {app_id} AND isSandbox = 0 AND isDeleted = 0
  AND key = 'paying_user'
GROUP BY value ORDER BY users DESC
```

---

### 7. `open_revenue.attributed_events_by_ts_rep`

#### Purpose

**Revenue attribution table.** The core table for all subscription revenue analysis. Contains purchase events from integrations (RevenueCat, App Store Connect) and SDK transaction_complete events, with attribution back to Superwall paywalls/experiments.

#### Schema

```sql
CREATE TABLE open_revenue.attributed_events_by_ts_rep
(
    -- Core columns
    `insertedAt` DateTime64(6, 'UTC') DEFAULT now64(),
    `id` String CODEC(ZSTD(1)),
    `name` LowCardinality(String),
    `meta` String CODEC(ZSTD(3)),
    `props` String CODEC(ZSTD(3)),
    `headers` String CODEC(ZSTD(3)),
    `debug` String CODEC(ZSTD(3)),
    `ts` DateTime64(6, 'UTC'),
    `purchasedAt` DateTime64(6, 'UTC'),
    `attributionTs` DateTime64(6, 'UTC'),
    `originalTransactionId` String CODEC(ZSTD(1)),
    `applicationId` UInt32,
    `isSandbox` UInt8,
    `attributionProps` String CODEC(ZSTD(3)),
    `attributionEventId` String CODEC(ZSTD(1)),

    -- Materialized columns (extracted from JSON at insert time)
    `organizationId` UInt32,
    `appUserId` Nullable(String),
    `vendorId` Nullable(String),
    `source` String,                          -- 'sdk' or 'integration'
    `integration` LowCardinality(Nullable(String)), -- 'revenue_cat', 'app_store_connect'
    `store` LowCardinality(Nullable(String)), -- 'APP_STORE', 'STRIPE', 'PROMOTIONAL'
    `experimentId` Nullable(UInt32),
    `variantId` Nullable(UInt32),
    `placement` Nullable(String),
    `paywallId` Nullable(UInt32),
    `transactionCompleteEventDate` Nullable(DateTime64(6, 'UTC')),
    `installDate` Nullable(DateTime64(6, 'UTC')),
    `transactionId` Nullable(String),
    `price` Nullable(Decimal(65, 2)),
    `priceInPurchasedCurrency` Nullable(Decimal(65, 2)),
    `proceeds` Nullable(Decimal(65, 2)),
    `exchangeRate` Nullable(Decimal(65, 6)),
    `productId` Nullable(String),
    `periodType` LowCardinality(Nullable(String)), -- 'TRIAL', 'NORMAL', 'PROMOTIONAL', 'INTRO'
    `isTrialConversion` UInt8,
    `takehomePercentage` Float64,
    `commissionPercentage` Float64,
    `taxPercentage` Float64,
    `environment` LowCardinality(String),
    `newProductId` Nullable(String),
    `expirationAt` Nullable(DateTime64(6, 'UTC')),
    `cancelReason` LowCardinality(Nullable(String)),
    `isFamilyShare` UInt8,
    `isSmallBusiness` UInt8,
    `isRefund` UInt8,
    `countryCode` LowCardinality(Nullable(String)),
    `currencyCode` LowCardinality(Nullable(String)),
    `offerCode` Nullable(String),
    `sdkVersion` Nullable(String),
    `appVersion` Nullable(String),
    -- Apple Search Ads attribution fields
    `appleSearchAdsAdGroupId`, `appleSearchAdsAdGroupName`, `appleSearchAdsAdId`,
    `appleSearchAdsAttribution`, `appleSearchAdsBidAmount`, `appleSearchAdsBidCurrency`,
    `appleSearchAdsCampaignId`, `appleSearchAdsCampaignName`, `appleSearchAdsConversionType`,
    `appleSearchAdsCountryOrRegion`, `appleSearchAdsKeywordId`, `appleSearchAdsKeywordName`,
    `appleSearchAdsMatchType`, `appleSearchAdsOrgId`,
    -- Other
    `userAttributes` Nullable(String),
    `demandScore` Nullable(Int32),            -- 0-99 purchase intent score
    `demandTier` Nullable(String)
)
ENGINE = SharedReplacingMergeTree(attributionTs)
PARTITION BY toYYYYMM(ts)
ORDER BY (applicationId, isSandbox, toStartOfHour(ts), name, id)
SETTINGS index_granularity = 8192
```

#### Key Details

- **Version column**: `attributionTs` (not `insertedAt`) — controls dedup in ReplacingMergeTree
- **Always use FINAL**
- **PARTITION BY**: `toYYYYMM(ts)` — monthly

##### Event Names (`name`)

| Name                    | Description                         | Count (app 1, 2025) |
| ----------------------- | ----------------------------------- | ------------------- |
| `expiration`            | Subscription expired                | 82,410              |
| `cancellation`          | Subscription cancelled              | 81,239              |
| `renewal`               | Subscription renewed                | 78,567              |
| `initial_purchase`      | First purchase (trial or paid)      | 61,930              |
| `transaction_complete`  | SDK-reported purchase completion    | 61,124              |
| `billing_issue`         | Payment failed                      | 16,531              |
| `non_renewing_purchase` | One-time purchase                   | 6,305               |
| `product_change`        | Subscription product changed        | 1,097               |
| `uncancellation`        | User re-subscribed after cancelling | 654                 |

##### Source and Integration

- **source**: `sdk` (from Superwall SDK `transaction_complete`) or `integration` (from RevenueCat, App Store Connect, etc.)
- **integration values**: `revenue_cat`, `app_store_connect`
- `transaction_complete` events always have source=`sdk`; all other event names come from integrations

##### Attribution

- **attributionEventId**: Non-empty when the revenue event is attributed to a Superwall paywall presentation
- Events with empty `attributionEventId` are organic/unattributed
- Attribution rate varies by event type (e.g. app 1: `initial_purchase` 84% attributed, `renewal` 62%)

##### periodType Values

| Value         | Meaning                                          | Count (app 1, 2025) |
| ------------- | ------------------------------------------------ | ------------------- |
| `NORMAL`      | Regular paid period                              | 220,487             |
| `TRIAL`       | Free trial period                                | 107,547             |
| NULL          | SDK transaction_complete events (no period info) | 61,124              |
| `PROMOTIONAL` | Promotional offer                                | 377                 |
| `INTRO`       | Introductory offer                               | 322                 |

**Note**: Case varies — always use `lower(periodType)` for filtering.

##### cancelReason Values

`UNSUBSCRIBE` (61,641), `BILLING_ERROR` (17,387), `CUSTOMER_SUPPORT` (2,206), `DEVELOPER_INITIATED` (5)

##### Store Values

`APP_STORE`, `STRIPE`, `PROMOTIONAL`

##### `attributionProps` JSON Keys

`paywallId`, `variantId`, `experimentId`, `placement`, `appUserId`, `platform`, `store`, `productId`, `vendorId`, `appVersion`, `sdkVersion`, `countryCode`, `currencyCode`, `ts` (transaction_complete event date), `installDate`, `attrDemandScore`, `attrDemandTier`, `transactionId`, `price`, `priceInPurchasedCurrency`, `proceeds`, `exchangeRate`, `periodType`, `isTrialConversion`, `takehomePercentage`, `commissionPercentage`, `taxPercentage`, `environment`, `newProductId`, `expirationAt`, `cancelReason`, `isFamilyShare`, `isSmallBusiness`, `isRefund`, `offerCode`, `userAttributes`, Apple Search Ads fields

#### Trial Event Definitions

```sql
name = 'initial_purchase' AND lower(periodType) = 'trial'   -- Trial start
name = 'cancellation' AND lower(periodType) = 'trial'       -- Trial cancel
name = 'renewal' AND isTrialConversion = 1                   -- Trial conversion to paid
name = 'billing_issue' AND lower(periodType) = 'trial'      -- Trial billing issue
```

#### Dedup Pattern for Revenue

Events can arrive from multiple sources (SDK + RevenueCat + App Store Connect). Dedup by `(applicationId, name, originalTransactionId, transactionId, attributed)`:

```sql
SELECT applicationId, attributed,
  sum(price) AS net_revenue,
  sumIf(price, price > 0) AS gross_revenue,
  sumIf(price, price < 0) AS refund_revenue,
  uniq(originalTransactionId) as subscriptions,
  uniqIf(originalTransactionId, price > 0) as paid_subscribers
FROM (
  SELECT applicationId, originalTransactionId, transactionId, name,
    attributionEventId != '' as attributed,
    argMax(price, ts) AS price
  FROM open_revenue.attributed_events_by_ts_rep FINAL
  WHERE isSandbox = 0 AND applicationId = {app_id}
    AND ts >= now() - INTERVAL 90 DAY AND ts < now()
    AND isFamilyShare = 0
  GROUP BY applicationId, name, originalTransactionId, transactionId, attributed
)
GROUP BY applicationId, attributed
```

#### ARPU (Revenue per Paywall Open)

ARPU is computed as **revenue per paywall open**. Join two sources on date:

1. Paywall opens from `open_revenue.sdk_events_agg` (name=`paywall_open`, tsType=`event_time`)
2. Revenue from this table, using trial conversions (name=`renewal`, isTrialConversion=1)

This works because trial conversions share the same `transaction_complete` date as the paywall open that initiated them.

```sql
WITH opens AS (
    SELECT toDate(ts) as day,
      CASE WHEN breakdown['paywallId'] IN ('id1','id2') THEN 'a' ELSE 'b' END as seg,
      uniqIfMerge(vendorIds) as open_users
    FROM open_revenue.sdk_events_agg
    WHERE applicationId = {app_id} AND isSandbox = 0
      AND name = 'paywall_open' AND tsType = 'event_time'
      AND ts >= now() - INTERVAL 45 DAY AND ts < now()
    GROUP BY day, seg
),
rev AS (
    SELECT toDate(ts) as day,
      CASE WHEN JSONExtractString(attributionProps, 'paywallId') IN ('id1','id2') THEN 'a' ELSE 'b' END as seg,
      round(sum(price), 2) as revenue
    FROM open_revenue.attributed_events_by_ts_rep FINAL
    WHERE applicationId IN ({app_ids}) AND isSandbox = 0
      AND name = 'renewal' AND isTrialConversion = 1 AND price > 0
      AND ts >= now() - INTERVAL 45 DAY AND ts < now()
    GROUP BY day, seg
)
SELECT o.day, o.seg, o.open_users,
  coalesce(r.revenue, 0) as revenue,
  round(coalesce(r.revenue, 0) / o.open_users, 4) as rev_per_open
FROM opens o
LEFT JOIN rev r ON o.day = r.day AND o.seg = r.seg
ORDER BY o.day, o.seg
```

---

### 8. `open_revenue.paywall_open_events_agg`

#### Purpose

**Lifetime paywall open counts** aggregated by experiment, variant, paywall, and placement. An AggregatingMergeTree storing all-time unique users and total views per combination. No time dimension — purely lifetime aggregates.

#### Schema

```sql
CREATE TABLE open_revenue.paywall_open_events_agg
(
    `applicationId` Int32,
    `experimentId` Int64,
    `variantId` Int64,
    `paywallId` Int32,
    `placement` String,
    `environment` Enum8('PRODUCTION' = 1, 'SANDBOX' = 2) DEFAULT 'PRODUCTION',
    `users_state` AggregateFunction(uniq, String),
    `views_state` AggregateFunction(uniq, String)
)
ENGINE = SharedAggregatingMergeTree
ORDER BY (applicationId, environment, experimentId, variantId, paywallId, placement)
SETTINGS index_granularity = 8192
```

#### Key Details

- **No time column** — lifetime aggregates only. Cannot do time-based filtering.
- **No PARTITION** — single partition
- **Stats**: ~490K rows, 9,909 unique apps, 59,783 experiments, 78,045 paywalls
- **environment**: Enum with values `PRODUCTION` (491K rows) and `SANDBOX` (154K rows)
- **users_state**: `AggregateFunction(uniq, String)` — unique users who opened the paywall. Read with `uniqMerge(users_state)`.
- **views_state**: `AggregateFunction(uniq, String)` — unique views (event IDs, not user IDs). Read with `uniqMerge(views_state)`.
- **Note**: Despite the name `views_state`, this counts unique view event IDs, so the same user opening the same paywall twice counts as 2 views.

#### Vetted Queries

```sql
-- Top paywalls by unique users for an app
SELECT paywallId, placement, experimentId, variantId,
  uniqMerge(users_state) as unique_users,
  uniqMerge(views_state) as total_views
FROM open_revenue.paywall_open_events_agg
WHERE applicationId = {app_id} AND environment = 'PRODUCTION'
GROUP BY paywallId, placement, experimentId, variantId
ORDER BY unique_users DESC LIMIT 20
```

```sql
-- Compare A/B test variants
SELECT variantId,
  uniqMerge(users_state) as unique_users,
  uniqMerge(views_state) as total_views
FROM open_revenue.paywall_open_events_agg
WHERE applicationId = {app_id} AND environment = 'PRODUCTION'
  AND experimentId = {exp_id}
GROUP BY variantId ORDER BY variantId
```

---

# Related Tables (Not Documented Here But Referenced)

| Table                                              | Purpose                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `analytics.ps_applications`                        | App metadata replicated from PlanetScale, Superwall's application layer db. Use `applicationName` (not `name`). |
| `open_revenue.attributed_events_by_experiment_rep` | Revenue by A/B experiment (use FINAL)                                                                           |
| `open_revenue.sdk_events_agg`                      | Pre-aggregated SDK events — prefer over `events_rep` for counts/uniques. Uses AggregateFunction columns.        |
| `sw.device_attributes_rep`                         | Device-level attributes (use FINAL, filter isDeleted=0)                                                         |
| `sw.user_aliases_rep`                              | User ID to alias mappings (use FINAL, filter isDeleted=0)                                                       |

#### `open_revenue.sdk_events_agg` Quick Reference

Pre-aggregated SDK events. Much faster than raw tables for counts/uniques.

**ORDER BY:** `(applicationId, isSandbox, ts, tsType, name, breakdown)`

**Key columns:** `applicationId`, `isSandbox`, `ts`, `name`, `tsType`, `breakdown` (Map), `vendorIds` (use `uniqIfMerge`), `vendorIdsD1`..`D90` (retention cohorts)

**Event names:** `first_seen`, `session_start`, `paywall_open`, `transaction_start`, `transaction_complete`, `transaction_abandon`, `transaction_restore`, `transaction_fail`

**tsType:** `event_time` (when event occurred) or `install_time` (user's install date for cohorts)

**Breakdown map keys:** `store`, `countryCode`, `currencyCode`, `languageCode`, `bundleId`, `productId`, `placement`, `sdkVersion`, `platformWrapper`, `platform`, `platformEnvironment`, `subscriptionStatus`, `variantId`, `experimentId`, `paywallId`

```sql
-- Weekly installs
SELECT toStartOfWeek(ts, 1) as week, uniqIfMerge(vendorIds) as installs
FROM open_revenue.sdk_events_agg
WHERE applicationId = {app_id} AND isSandbox = 0
  AND name = 'first_seen' AND tsType = 'install_time'
  AND ts >= now() - INTERVAL 90 DAY AND ts < now()
GROUP BY week ORDER BY week
```

---

# Cross-Table Relationships

```
sw.applications_rep (applicationId)
  ├── sw.events_rep (applicationId) — raw event firehose
  │     └── sw.events_hr_agg (applicationId) — hourly aggregation
  │     └── sw.demand_score_events_rep (applicationId) — events with demand scores
  ├── sw.subscription_status_rep (applicationId, appUserId) — current sub status
  ├── sw.user_attributes_rep (applicationId, appUserId) — user attribute KV store
  ├── open_revenue.attributed_events_by_ts_rep (applicationId) — revenue events
  └── open_revenue.paywall_open_events_agg (applicationId) — lifetime paywall opens
```

#### Finding an Application

1. Search `analytics.ps_applications` by name (or `sw.applications_rep`)
2. If multiple results, check `sw.events_hr_agg` for recent event counts
3. Show `applicationId` + link: `superwall.com/applications/:applicationId`

```sql
SELECT applicationId, name, platform
FROM sw.applications_rep FINAL
WHERE name ILIKE '%app_name%' AND isDeleted = 0
```

---

# Identifying Stripe vs App Store Paywalls

iOS and Android apps can sell Stripe products (aka app2web, in-app web checkout) within their Superwall paywalls. In this scenario, paywall_open and revenue events events appear under the app the purchase originated in.

i.e. do not assume Stripe revenue is always attached to any specific app / platform within a project.

---

# Query Best Practices Summary

1. **Always filter by `applicationId` first** — it's the leading ORDER BY key on every table
2. **Filter `isSandbox = 0`** for production data
3. **Use `FINAL`** on ReplacingMergeTree tables only when needed for deduplication, but **never** on `sw.events_rep`
4. **Filter `isDeleted = 0`** on tables with soft-delete (applications_rep, subscription_status_rep, user_attributes_rep, events_rep, demand_score_events_rep)
5. **Filter `ts < now()`** — some tables have future timestamps
6. **Only query `sw.events_rep` with `applicationId` and both `ts > toStartOfHour(now() - INTERVAL ...)` and `ts < now()`**, with a window no longer than 7 days
7. **Use `-Merge` combinators** on AggregatingMergeTree tables: `uniqMerge()`, `groupArraySortedMerge()`
8. **Never nest aggregate functions** — use subqueries instead
9. **Use `lower(periodType)`** in attributed_events — case is inconsistent
10. **Prefer aggregated tables** over `events_rep` when possible
11. **LIMIT everything** during exploration — these tables have billions of rows

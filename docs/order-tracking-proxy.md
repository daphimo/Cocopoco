# Unified order tracking app-proxy contract

The theme posts to one same-origin endpoint:

```http
POST /apps/order-tracking
Content-Type: application/json

{"orderNumber":"#1052","contact":"customer@example.com"}
```

This repository is a Shopify theme and contains no deployable backend. Implement this route in the store's existing Shopify app, then configure the theme section's **Secure proxy endpoint** to match. Do not add Admin API or carrier credentials to the theme.

## Required server configuration

- An offline Shopify Admin API access token stored by the app's normal session/token storage.
- `read_orders` access scope.
- `read_all_orders` only if tracking must cover orders older than Shopify's default 60-day order window; Shopify approval is required.
- App-proxy authentication using the app framework's `authenticate.public.appProxy(request)` or an equivalent constant-time verification of Shopify's `signature` parameter.
- Rate limiting keyed by shop plus client IP (and, where present, the signed `logged_in_customer_id`).

The app proxy signature proves that Shopify forwarded the request; it does not prove that the visitor owns an order. Order ownership must still be verified using the submitted contact value.

## Validation and order lookup

1. Accept `POST` and JSON only. Limit the request body and reject values longer than 64 characters for `orderNumber` or 254 characters for `contact`.
2. Normalize an order entry to the shop's order-name format without constructing an Admin GraphQL query from unchecked input. Escape all Shopify search syntax metacharacters or use a safely constructed `name:` filter.
3. Query a small bounded result set and require one exact, case-insensitive match against `Order.name` after normalization. Never accept an internal Shopify ID from the browser.
4. Compare the submitted contact on the server:
   - Email: trim and compare case-insensitively with `Order.email` (and `Customer.email` if the existing app already uses customer records).
   - Phone: normalize both values to digits plus an optional leading `+`, then compare with `Order.phone`; optionally include the order shipping/billing phone fields if that is the store's established checkout behavior.
5. If order lookup or contact verification fails, return the same response and similar timing:

```json
{"success":false,"code":"VERIFICATION_FAILED","message":"We couldn't find an order with those details."}
```

Do not reveal whether the order number exists. Do not log raw contact values. Never return addresses, line items, payment data, GraphQL errors, internal IDs, or the complete order object.

## Shopify Admin GraphQL data

Pin the query to the API version configured by the app. The current Shopify Admin GraphQL schema exposes the needed data on `Order.fulfillments` and `Fulfillment`:

```graphql
query TrackingOrder($query: String!) {
  orders(first: 5, query: $query) {
    nodes {
      name
      email
      phone
      displayFulfillmentStatus
      fulfillments {
        status
        displayStatus
        estimatedDeliveryAt
        trackingInfo(first: 20) {
          company
          number
          url
        }
        events(first: 50, reverse: true) {
          nodes {
            status
            happenedAt
            estimatedDeliveryAt
            city
            province
            country
          }
        }
      }
    }
  }
}
```

`Order`, `Fulfillment`, and `FulfillmentEvent` above are Admin GraphQL objects. They are not assumed to be available as Liquid objects on this public page.

Inspect every fulfillment and every `trackingInfo` entry. Multiple fulfillments and multiple packages are valid. Exclude cancelled fulfillments unless the customer needs their cancelled state displayed. If a verified order has no fulfillment, return `NOT_FULFILLED`; if it has a fulfillment but no tracking number, return `NO_TRACKING`.

## Carrier detection and adapters

Normalize `trackingInfo.company` by trimming, lowercasing, and removing punctuation/extra whitespace. Suggested aliases:

```js
const carrierAliases = {
  delhivery: ['delhivery'],
  ekart: ['ekart', 'ekart logistics'],
};

const carrierAdapters = {
  delhivery: shopifyTrackingAdapter,
  ekart: shopifyTrackingAdapter,
};
```

Match aliases as complete normalized names, not arbitrary substrings. The Phase 1 adapter only normalizes Shopify's fulfillment data. It does not call Delhivery or Ekart. If the company is missing or unsupported, return `UNKNOWN_CARRIER`; do not guess from the AWB format or URL hostname.

Future carrier adapters can implement `track(awb, shopifyFulfillment)` and return the same normalized shape. Carrier API errors must fall back to sanitized Shopify data or a controlled service error.

## Status normalization

Map Shopify `displayStatus`, `status`, and fulfillment-event status values on the server to this closed set:

```text
ORDER_CONFIRMED
PICKED_UP
IN_TRANSIT
OUT_FOR_DELIVERY
DELIVERED
FAILED
CANCELLED
UNKNOWN
```

Unknown values must map to `UNKNOWN`. The frontend renders normalized values only and remains carrier-agnostic.

## Success response

Always return `shipments` so split shipments are explicit. A single-shipment response uses the same structure:

```json
{
  "success": true,
  "order": { "number": "#1052" },
  "shipments": [
    {
      "carrier": "delhivery",
      "carrierName": "Delhivery",
      "awb": "123456789012",
      "trackingUrl": "https://example-carrier.test/track/123456789012",
      "status": "IN_TRANSIT",
      "statusLabel": "In Transit",
      "estimatedDelivery": "2026-09-25T00:00:00Z",
      "events": [
        {
          "status": "PICKED_UP",
          "label": "Picked Up",
          "location": "Surat, Gujarat, India",
          "timestamp": "2026-09-22T10:30:00Z"
        }
      ]
    }
  ]
}
```

Only return an `http` or `https` tracking URL sourced from Shopify. Cap fulfillment, package, and event counts. Sort events consistently (the theme displays them in the order returned).

## Controlled errors

Use a suitable HTTP status with one of these sanitized codes:

| Code | Meaning |
| --- | --- |
| `VERIFICATION_FAILED` | Order absent or contact mismatch (same public response) |
| `NOT_FULFILLED` | Verified order has not shipped |
| `NO_TRACKING` | Fulfillment exists without a tracking number |
| `UNKNOWN_CARRIER` | Shopify carrier is absent or unsupported |
| `RATE_LIMITED` | Too many attempts |
| `SERVICE_ERROR` | Admin API or unexpected server failure |

Do not return upstream errors, stack traces, tokens, internal URLs, Shopify IDs, or debug fields.

## App proxy configuration

An app can configure one proxy root, but child routes under that root are supported. If the existing app already owns a proxy root, add order tracking beneath it and set the section endpoint to that storefront path rather than creating a second app proxy. For a dedicated path, the equivalent configuration is:

```toml
[access_scopes]
scopes = "read_orders,write_app_proxy"

[app_proxy]
url = "/app-proxy/order-tracking"
prefix = "apps"
subpath = "order-tracking"
```

The backend destination and exact framework route depend on the existing app and therefore cannot be created inside this theme repository.

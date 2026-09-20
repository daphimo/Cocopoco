# Delhivery tracking proxy contract

The tracking section calls this same-origin Shopify app proxy route only after a visitor submits an AWB:

`GET /apps/delhivery-tracking?awb=XXXXXXXXXXXX`

The theme contains no Delhivery credentials. Deploy the route in a Shopify app and configure an app proxy with subpath `delhivery-tracking`.

## Environment variables

```dotenv
DELHIVERY_API_TOKEN=
DELHIVERY_TRACKING_API_URL=https://track.delhivery.com/api/v1/packages/json/
```

For staging, configure `DELHIVERY_TRACKING_API_URL=https://staging-express.delhivery.com/api/v1/packages/json/` and use the matching staging token.

## Upstream request

```http
GET {DELHIVERY_TRACKING_API_URL}?waybill=XXXXXXXXXXXX&ref_ids=
Authorization: Token {DELHIVERY_API_TOKEN}
Accept: application/json
```

The backend must verify the Shopify app-proxy signature, accept only one bounded AWB value, rate-limit requests, optionally cache briefly, and never accept an upstream URL from the browser.

Delhivery returns shipment records under `ShipmentData`, with the current shipment in `ShipmentData[0].Shipment`. Useful current fields include `AWB`, `ReferenceNo`, `Status.Status`, `Status.StatusDateTime`, `Status.StatusLocation`, `Status.Instructions`, `Status.StatusType`, and `Status.NSLCode`. Scan history is found under `Shipment.Scans[].ScanDetail`.

Normalize the response before returning it to the theme:

```json
{
  "success": true,
  "shipment": {
    "awb": "XXXXXXXXXXXX",
    "reference": "ORDER-1001",
    "status": "In Transit",
    "statusDateTime": "2026-09-20T10:30:00",
    "location": "Ahmedabad",
    "instructions": "Shipment in transit",
    "statusType": "UD",
    "nslCode": "X-XXX"
  },
  "events": [
    {
      "status": "In Transit",
      "dateTime": "2026-09-20T10:30:00",
      "location": "Ahmedabad",
      "instructions": "Shipment in transit"
    }
  ]
}
```

Return `404` with `{ "success": false, "code": "NOT_FOUND" }` when Delhivery returns no shipment. Convert authentication, rate-limit, upstream, and malformed-response failures to sanitized `401`, `429`, or `502` responses without returning raw Delhivery errors or credentials.

Keep the complete upstream status and NSL interpretation on the server. The theme applies a conservative customer-facing grouping and falls back to “Shipment Update” for unknown values rather than exposing raw NSL codes.

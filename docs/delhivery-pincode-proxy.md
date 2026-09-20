# Delhivery pincode proxy contract

The storefront checker calls the same-origin Shopify app proxy route:

`GET /apps/delhivery-serviceability?pincode=395007`

The theme deliberately contains no Delhivery credential. Deploy this route in a Shopify app and configure an app proxy with subpath `delhivery-serviceability`.

## Required server configuration

- `DELHIVERY_API_TOKEN`: production token from Delhivery One.
- `DELHIVERY_API_BASE_URL`: `https://track.delhivery.com` in production or `https://staging-express.delhivery.com` in testing.

The backend must validate the Shopify app-proxy signature and require exactly one six-digit `pincode`. It must never accept a caller-provided upstream URL or return the Delhivery token.

Call Delhivery using:

```http
GET {DELHIVERY_API_BASE_URL}/c/api/pin-codes/json/?filter_codes=395007
Authorization: Token {DELHIVERY_API_TOKEN}
Accept: application/json
```

Interpret `delivery_codes[0].postal_code`. An absent record or empty `delivery_codes` is non-serviceable. A blank `remarks` value is serviceable; `Embargo` is temporarily non-serviceable. Service flags are available only when their corresponding value is `Y`.

Return only this normalized JSON contract:

```json
{
  "serviceable": true,
  "pincode": "395007",
  "city": "Surat",
  "district": "Surat",
  "stateCode": "GJ",
  "cod": true,
  "prepaid": true,
  "pickup": false,
  "replacement": true,
  "oda": false,
  "remarks": ""
}
```

Mapping:

- `cod`: `postal_code.cod === "Y"`. If an account response uses `cash` as its COD capability, confirm this with Delhivery and normalize it server-side; do not infer COD from general serviceability.
- `prepaid`: `postal_code.pre_paid === "Y"`.
- `pickup`: `postal_code.pickup === "Y"`.
- `replacement`: `postal_code.repl === "Y"`.
- `oda`: `postal_code.is_oda === "Y"`.

Recommended responses are `400` for an invalid pincode, `401` for an invalid app-proxy signature, `502` for a Delhivery failure, and `200` with `serviceable: false` for a valid but unsupported pincode.

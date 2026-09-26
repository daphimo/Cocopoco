# Wishlist flow

## Audit result

The current wishlist **does not write to a Shopify customer metafield**, whether the visitor is logged in or logged out.

Wishlist membership is stored only in the browser's `localStorage` under the key `shopify-wishlist`. The stored value is a comma-separated list of product handles, for example:

```text
shopify-wishlist=canvas-tote,pink-notebook
```

The theme uses Shopify's `customer` Liquid object only to decide whether wishlist controls should be shown. No customer ID, customer metafield, Storefront API mutation, Admin API mutation, or app-proxy wishlist endpoint is used.

This means a logged-in customer's wishlist:

- remains tied to that browser profile and storefront origin;
- does not follow the customer to another browser or device;
- can disappear when site data is cleared;
- is shared by different customer accounts using the same browser profile;
- is not copied or merged when a guest signs in; and
- is not available in Shopify Admin as customer data.

## Components

| File | Responsibility |
| --- | --- |
| `config/settings_schema.json` | Defines the wishlist color and the `guest_signin` / `login_required` presentation mode. |
| `layout/theme.liquid` | Loads `wishlist.css` and `wishlist.js` globally and supplies a live status region. |
| `snippets/wishlist-button.liquid` | Renders either an interactive heart button or a sign-in link. |
| `sections/header.liquid` | Renders the wishlist page link and, when allowed, its count badge. |
| `assets/wishlist.js` | Reads and writes browser storage, synchronizes buttons/counts, renders the wishlist page, and adds all available items to the cart. |
| `templates/page.wishlist.json` | Assigns the wishlist section to the wishlist page template. |
| `sections/wishlist-products.liquid` | Renders the wishlist page shell, sign-in state, empty state, and Add all button. |
| `templates/product.card.json` | Supplies the alternate `?view=card` product response used by JavaScript. |
| `sections/wishlist-product-card.liquid` and `snippets/wishlist-product-card.liquid` | Render a saved product card and expose its handle, selected variant ID, and availability. |

## End-to-end behavior

### 1. Theme initialization

`layout/theme.liquid` loads the wishlist stylesheet and deferred JavaScript on every storefront page. When the DOM is ready, `wishlist.js` runs `init()`.

`init()` reads `localStorage`, synchronizes every wishlist button, updates every header count badge, and renders any element marked `data-wishlist-section`.

The script also reinitializes after Shopify reloads a section, after its own `shopify-wishlist:updated` event, and when another tab changes the same local-storage key.

### 2. Login-related presentation

The theme setting `wishlist_flow` has two modes:

- `guest_signin` (default): everyone can use the local wishlist. Logged-out visitors see a message inviting them to sign in, but signing in does not persist or migrate the data to Shopify.
- `login_required`: logged-out visitors receive sign-in links instead of wishlist buttons, and the wishlist page does not get `data-wishlist-section`, so its grid does not initialize. A logged-in visitor gets the normal controls, but those controls still use the same browser-local storage.

The Liquid checks are server-rendered access/presentation checks only. They do not alter the JavaScript storage implementation.

### 3. Adding or removing a product

Wishlist buttons carry the product handle in `data-product-handle`. On click, `wishlist.js`:

1. validates the handle against an alphanumeric/hyphen pattern;
2. reads and de-duplicates the comma-separated handles in `localStorage`;
3. adds the handle if absent or removes it if present;
4. writes the updated list back to `localStorage` (or removes the key for an empty list);
5. emits `shopify-wishlist:updated`;
6. refreshes button active states and `aria-pressed` labels;
7. refreshes the header count; and
8. announces the change through the live status regions.

There is no HTTP request in this add/remove flow.

### 4. Rendering the wishlist page

The wishlist page starts as an empty grid shell. JavaScript reads the saved product handles and requests each product from:

```text
/products/{handle}?view=card
```

That alternate product view renders a `.wishlist-product-card`. The script parses the returned HTML, confirms that the returned card has the expected handle, caches it for the current page session, and inserts valid cards in saved order.

If no cards can be rendered, the empty or unavailable message is shown. Removing an item causes the grid to render again from local storage.

These product requests only retrieve storefront HTML. They do not read or write a customer record.

### 5. Adding all items to the cart

The Add all button collects the selected/default variant ID from each rendered, available wishlist card and sends one JSON request to:

```text
POST /cart/add.js
```

On success, the browser is redirected to the cart. Sold-out cards and invalid variant IDs are excluded. Adding items to the cart does not clear the wishlist.

## Network and persistence summary

| Action | Destination | Persistent result |
| --- | --- | --- |
| Add/remove wishlist item | No network request | Product handles in browser `localStorage` |
| Load wishlist cards | `GET /products/{handle}?view=card` | None; HTML is cached only in JavaScript memory for that page load |
| Add all to cart | `POST /cart/add.js` | Shopify cart lines |
| Sign in | Shopify customer-account route | Login session only; wishlist is not synchronized |
| Customer metafield write | Not implemented | None |

## What is required for customer metafield persistence

A theme must not contain an Admin API token, and this implementation has no authenticated server endpoint capable of updating customer metafields. Cross-device customer persistence therefore requires a Shopify app/backend (normally exposed to the storefront through a signed app proxy) that performs the protected Admin API operation.

A suitable design would be:

1. Create a customer metafield definition, for example namespace/key `custom.wishlist`, with an agreed value format. A JSON list of stable product or variant identifiers is preferable to display titles. Product handles are convenient but can change.
2. Add authenticated app-proxy endpoints to read and update the wishlist.
3. On the server, validate the Shopify proxy signature and require the signed `logged_in_customer_id`. Never accept a customer ID supplied by browser JSON as proof of identity.
4. Validate item types, ownership/shop context, list size, and payload size before using Admin GraphQL to read or write the metafield.
5. Return only the normalized wishlist payload and non-sensitive errors to the browser.
6. Update `wishlist.js` so authenticated sessions load from the endpoint and persist each mutation there. Keep local storage as an optional guest/offline cache.
7. Define the first-login merge rule explicitly: union guest and customer items, replace one side, or prompt the customer. After a successful merge, update both the server value and local cache.
8. Handle concurrent tabs/devices with a revision, timestamp, or server-side merge to avoid overwriting a newer list.

Conceptually, the desired logged-in flow is:

```text
heart click
  -> browser sends item mutation to signed app-proxy route
  -> app proxy identifies logged-in customer
  -> backend validates request
  -> backend writes customer metafield with Admin GraphQL
  -> backend returns normalized wishlist
  -> browser updates local cache, buttons, count, and grid
```

Until that backend and client synchronization are implemented, the sign-in wording "save your wishlist items" can imply account persistence that the code does not currently provide.

## Verification checklist

After account persistence is implemented, verify at least these cases:

- a guest item is handled according to the chosen merge rule after login;
- a logged-in add/remove is visible in the customer's metafield in Shopify Admin;
- the same customer sees the same list in a second browser/device;
- two different customers using one browser do not see each other's server wishlist;
- logout does not expose account-only items to the next user;
- renamed/deleted products and unavailable variants degrade cleanly;
- failed writes are surfaced and do not falsely appear saved;
- oversized, malformed, unsigned, and unauthenticated requests are rejected; and
- simultaneous updates do not silently discard items.

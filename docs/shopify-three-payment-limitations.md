# Shopify limitations for three-payment pre-purchases

This document summarizes platform constraints when you want customers to pay in **three milestones** on a single pre-purchase—for example: deposit at checkout → lock-in payment midway → final payment when the item ships.

Momo’s current implementation plan uses a **two-payment** model (deposit + balance on fulfillment), which fits Standard Shopify without Plus. This doc explains why the original three-payment idea requires a different approach.

## What Shopify natively supports

Shopify’s **deferred purchase options** (pre-orders and try-before-you-buy) are built around **two payments per order**, not three:

1. **Deposit at checkout** — a partial amount (fixed dollar amount or percentage)
2. **One remaining balance charge** — triggered by a single rule:
   - A specific date (`EXACT_TIME`)
   - X days after checkout (`TIME_AFTER_CHECKOUT`)
   - When the order is fulfilled (`ON_FULFILLMENT`, stable since Admin API `2026-01`)

At checkout, Shopify **vaults the customer’s payment method** (a payment mandate) so the merchant can collect the remaining balance later without sending a new checkout link.

References:

- [About pre-order and Try Before You Buy (TBYB)](https://shopify.dev/docs/apps/build/purchase-options/deferred)
- [Due on fulfillment payment term for pre-orders](https://shopify.dev/changelog/due-on-fulfillment-payment-term-available-for-pre-orders)
- [Build a pre-order and TBYB solution](https://shopify.dev/docs/apps/build/purchase-options/deferred/build-deferment-solution)

## Why three milestone payments don’t fit cleanly

### One order = one “remaining balance” event

For a single order with a pre-order selling plan, Shopify treats deferred payment as:

- **Deposit(s) summed at checkout**
- **One outstanding balance** with **one due-date or trigger rule**

There is no native selling-plan configuration for: “charge 33% now, 33% on date X, 34% on ship.” The billing policy is deposit plus **one** `remainingBalanceChargeTrigger`.

If the cart has multiple pre-order lines with different due dates, Shopify still collapses to **one** deferred due date per order (earliest date wins; “due on fulfillment” takes priority if any line uses it).

### Custom partial charges require Shopify Plus

Apps can charge vaulted cards later via the Admin API mutation `orderCreateMandatePayment`. That mutation supports charging a **custom amount**—but Shopify documents that the **`amount` field requires Shopify Plus**.

On **Standard / Advanced** (non-Plus):

- You can typically charge the **full remaining balance** in one shot (via mandate / payment schedule)
- You **cannot** reliably auto-charge arbitrary partial amounts for a second and third milestone from the same mandate flow the way a custom installment engine would

A true **three-step auto-charge** (deposit → lock-in → ship) generally needs **Plus**, or a workaround that isn’t “one order, three auto-debits.”

Reference: [`orderCreateMandatePayment`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderCreateMandatePayment)

### BNPL / Shop Pay Installments is not the same thing

**Shop Pay Installments**, Klarna, Affirm, and similar options split payment at checkout for **customer financing**. They are not merchant-controlled milestones tied to production, lock-in, or shipping.

That is unrelated to a flow like: “charge 30% now, 30% when we start build, 40% when we ship.”

### Other platform limits (any payment model)

Pre-orders also cannot be used with:

- Shopify POS
- B2B
- Draft orders
- Some legacy checkout setups (`checkout.liquid` without Checkout Extensibility)

They require eligible payment gateways (typically **Shopify Payments** and a short list of others). Local payment methods do not work for deferred purchase options.

Pre-orders also do not support “Buy X get Y” discounts, and selling plan data is deleted 48 hours after the purchase-options app is uninstalled.

## Practical paths for a three-payment flow

| Approach | Auto-charge all 3? | Notes |
|----------|-------------------|--------|
| **Native two-payment pre-order** | 2 of 3 only | Deposit now + balance on ship (or on a fixed date). Best fit on Standard. |
| **Shopify Plus + custom app** | Yes | Use a selling plan for the deposit + `orderCreateMandatePayment` with custom `amount` for lock-in and final charges; the app owns scheduling, failures, and retries. |
| **Hybrid (Standard)** | Partial | Deposit at checkout; lock-in and final via **payment links / draft order invoices**—works but is not seamless auto-charge; more manual ops and drop-off risk. |
| **Third-party preorder apps** | Varies | Some advertise multi-step plans; many require **Plus** on Shopify (e.g. PreProduct documents multi-step on Plus or non-Shopify stores). |
| **Three separate orders** | Manual | Technically possible but poor UX, harder inventory and accounting; not recommended. |

## Bottom line for Momo

- **Standard Shopify + one order:** plan for **deposit + one final charge** (usually on fulfillment). This is what the current pre-order implementation plan targets.
- **Three auto-charged milestones on one commitment:** Shopify does not offer that out of the box. You need **Plus + a custom app** (e.g. extending the existing app at `Projects/momo/app`) or accept **payment links** for later milestones.
- The **lock-in payment in the middle** is the part Shopify does not model natively. It must be folded into the deposit, moved to the final charge, handled manually, or built on Plus-level APIs.

## Related Momo repos

- **Theme:** `Projects/momo/shopify` — product buy box, cart, purchase-option UI
- **App:** `Projects/momo/app` — React Router app (reviews today; pre-order selling plans planned here)

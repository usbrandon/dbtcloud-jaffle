# Jaffle Shop modeling context

This document records current project evidence and proposed design intent. Update it with the models so future AI requests use the same business definitions. It contains no credentials. Evidence below was inspected in this workspace on 2026-09-09; recheck current files before implementation.

## Goal and conventions

The initial implementation provides a customer dimension (`dim_customer`) and an order-grain fact (`fct_orders`) for learning and analytical use, using the selected Kimball and Datacoves guidance. The fact contains order attributes and an order count; monetary measures for the originally proposed `fct_sales` remain pending verified payment data and definitions. Preserve existing model names and consumers unless a reviewed change explicitly replaces them. Place reusable customer/order business objects in L2 bays; use L3 coves for a defined reporting audience rather than duplicating models solely to populate a layer.

## Verified repository evidence

- `models/L1_inlets/jaffle_shop/sources.yml` declares only `jaffle_shop.customers` and `jaffle_shop.orders`. The order description says it includes cancelled and deleted orders.
- `stg_customers.sql` selects id as customer_id, first_name and last_name. Its source projection contains no updated_at or customer attribute history.
- `stg_orders.sql` selects id as order_id, user_id as customer_id, order_date and status. It provides no order lines, amounts, currency or payment status.
- `models/L2_bays/customers/customers.sql` already joins customer attributes to order aggregates at customer_id: first_order_date, most_recent_order_date and number_of_orders. It retains customers without orders and coalesces their count to zero. The aggregate currently counts all staged orders without status filtering.
- Existing customer YAML declares unique/not_null tests on customer_id. Test definitions are evidence of intent, not proof of a current successful build.
- No payments source or staging model is currently declared. This does not prove payments are absent from the warehouse; warehouse discovery has not established their location or schema for this design.

## Proposed design and unresolved definitions

Start with one row per customer for a current-state dimension and one row per order for the fact. Reuse the existing customer logic where it fits; inspect downstream references before any rename. Do not silently reinterpret the existing all-orders count as a completed-sales count.

Before adding monetary measures, establish the actual payments source and its order key, units (including whether amounts are cents), currency, success statuses, refunds, gift cards and coupon representation. Payments collected are not proof of gross billed revenue. Definitions of a sale, gross_amount, net_amount_paid and lifetime_value remain unresolved. Do not fabricate monetary columns, assume every payment succeeds, or substitute zero for missing financial evidence.

If verified payment data is added, aggregate it to order_id before joining orders, then aggregate the resulting order-grain measures to customer_id for customer metrics. Keep the dependency graph acyclic; a base customer dimension should not depend on a fact that itself depends on the enriched dimension.

Historical customer names are not an established requirement. Treat SCD Type 2 as a separate design decision. Existing source projections do not establish a reliable update timestamp or historical coverage. Starting snapshots now cannot recover prior names. If history is requested, define capture strategy, effective-time meaning, version key, boundary semantics and behavior for older orders before implementing it.

## Validation expectations

Check customer and order grain, foreign-key coverage, absence of join fan-out, zero-order customers, and status treatment. Once payment definitions exist, reconcile order and customer amounts to the verified source at a consistent grain and currency, including refunds and failed payments. Verify parse/build/test with the project's selected engine and developer environment; do not claim checks have run based on this document.

Document finalized model-specific meanings in adjacent dbt YAML descriptions and `config.meta.modeling`, with appropriate dbt tests. Preserve standard ref/source usage and existing schema macros so developer destinations remain configurable.

{{ config(schema="L2_ORDERS") }}
select
    order_id,
    customer_id,
    order_date,
    status as order_status,
    1 as order_count
from {{ ref("stg_orders") }}

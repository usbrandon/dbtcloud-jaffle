select
    id as customer_id,
    first_name,
    last_name
from {{ source('jaffle_shop', 'customers') }}

{{ config(schema='L1_JAFFLE_SHOP', alias='stg_customers') }}

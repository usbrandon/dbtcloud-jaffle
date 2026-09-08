Welcome to your new dbt project!

### Using the starter project

Try running the following commands:
- dbt run
- dbt test


### Resources:
- Learn more about dbt [in the docs](https://docs.getdbt.com/docs/introduction)
- Check out [Discourse](https://discourse.getdbt.com/) for commonly asked questions and answers
- Join the [dbt community](https://getdbt.com/community) to learn from other analytics engineers
- Find [dbt events](https://events.getdbt.com) near you
- Check out [the blog](https://blog.getdbt.com/) for the latest news on dbt's development and best practices
```mermaid
flowchart LR
  subgraph subgraph_source_jaffle_shop_jaffle_shop_customers["jaffle_shop.customers"]
    source_jaffle_shop_jaffle_shop_customers_ID["# ID  (T)"]
    source_jaffle_shop_jaffle_shop_customers_FIRST_NAME["Aa FIRST_NAME  (T)"]
    source_jaffle_shop_jaffle_shop_customers_LAST_NAME["Aa LAST_NAME  (T)"]
  end
  subgraph subgraph_model_jaffle_shop_stg_customers["stg_customers"]
    model_jaffle_shop_stg_customers_customer_id["# customer_id  (P)"]
    model_jaffle_shop_stg_customers_first_name["Aa first_name  (R)"]
    model_jaffle_shop_stg_customers_last_name["Aa last_name  (R)"]
  end
  subgraph subgraph_model_jaffle_shop_customers["customers"]
    model_jaffle_shop_customers_customer_id["# customer_id  (P)"]
    model_jaffle_shop_customers_first_name["Aa first_name  (R)"]
    model_jaffle_shop_customers_last_name["Aa last_name  (R)"]
  end
  source_jaffle_shop_jaffle_shop_customers_ID --> model_jaffle_shop_stg_customers_customer_id
  source_jaffle_shop_jaffle_shop_customers_FIRST_NAME --> model_jaffle_shop_stg_customers_first_name
  source_jaffle_shop_jaffle_shop_customers_LAST_NAME --> model_jaffle_shop_stg_customers_last_name
  model_jaffle_shop_stg_customers_customer_id --> model_jaffle_shop_customers_customer_id
  model_jaffle_shop_stg_customers_first_name --> model_jaffle_shop_customers_first_name
  model_jaffle_shop_stg_customers_last_name --> model_jaffle_shop_customers_last_name
  classDef srcNode stroke:#2dd4bf,stroke-width:2px,rx:6,ry:6;
  classDef mdlNode stroke:#4d8dff,stroke-width:2px,rx:6,ry:6;
  class subgraph_source_jaffle_shop_jaffle_shop_customers srcNode
  class subgraph_model_jaffle_shop_stg_customers,subgraph_model_jaffle_shop_customers mdlNode
```
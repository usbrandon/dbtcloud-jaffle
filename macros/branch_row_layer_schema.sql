-- branch-row layer schema naming v1
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set resolved = namespace(schema=none) -%}
    {%- set parts = node.original_file_path.split('/') -%}
    {%- if node.resource_type == 'model' and node.package_name == 'jaffle_shop' -%}
        {%- for layer in ['L1_inlets', 'L2_bays', 'L3_coves'] -%}
            {%- if layer in parts -%}
                {%- set position = parts.index(layer) + 1 -%}
                {%- if position < parts | length - 1 -%}
                    {%- set expected = layer.split('_')[0] ~ '_' ~ parts[position] | upper -%}
                    {%- if custom_schema_name == expected -%}
                        {%- set resolved.schema = expected -%}
                    {%- endif -%}
                {%- endif -%}
            {%- endif -%}
        {%- endfor -%}
    {%- endif -%}
    {%- if resolved.schema is not none -%}
        {%- set developer_prefix = env_var('SNOWFLAKE_SCHEMA_PREFIX', '') | trim | trim('_') -%}
        {{ (developer_prefix ~ '_' if developer_prefix else '') ~ resolved.schema }}
    {%- else -%}
        {%- if custom_schema_name is none -%}
            {{ target.schema }}
        {%- else -%}
            {{ target.schema }}_{{ custom_schema_name | trim }}
        {%- endif -%}
    {%- endif -%}
{%- endmacro %}

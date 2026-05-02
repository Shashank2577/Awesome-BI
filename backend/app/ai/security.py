"""
AI Security Layer
Ensures AI models only receive schema metadata (column names, types, descriptions)
but NEVER actual row data. This prevents data leakage through LLM prompts.
"""

import json
from typing import Dict, Any, List


def sanitize_schema_for_ai(
    schema: Dict[str, Any],
    include_sample_values: bool = False,
    max_sample_rows: int = 0,
) -> Dict[str, Any]:
    """
    Strip all actual data values from schema, keeping only metadata.

    Args:
        schema: Full schema with tables and optionally sample data
        include_sample_values: If True, include a few anonymized sample values
        max_sample_rows: Max sample rows to include (0 = none)

    Returns:
        Sanitized schema safe for AI consumption
    """
    safe_schema = {"tables": []}

    for table in schema.get("tables", []):
        safe_table = {
            "name": table.get("name", "unknown"),
            "description": table.get("description", ""),
            "columns": [],
        }

        for col in table.get("columns", []):
            safe_col = {
                "name": col.get("name", "unknown"),
                "type": col.get("type", "unknown"),
                "nullable": col.get("nullable", True),
                "description": col.get("description", ""),
            }
            # NEVER include actual values unless explicitly allowed
            safe_table["columns"].append(safe_col)

        safe_schema["tables"].append(safe_table)

    return safe_schema


def build_metadata_prompt(datasource_name: str, schema: Dict[str, Any]) -> str:
    """
    Build a safe prompt containing ONLY schema metadata (no data values).
    This is the only prompt format that should be sent to AI models.
    """
    tables_text = []
    for table in schema.get("tables", []):
        cols = []
        for c in table.get("columns", []):
            desc = f" -- {c['description']}" if c.get("description") else ""
            cols.append(f"    {c['name']} ({c['type']}){desc}")
        tables_text.append(f"  Table: {table['name']}\n" + "\n".join(cols))

    return f"""DATABASE: {datasource_name}

SCHEMA METADATA (column names and types only - no actual data):
{"".join(tables_text)}

IMPORTANT SECURITY NOTICE:
- You are provided with column NAMES and TYPES only.
- You do NOT have access to actual row data or values.
- Never ask for or attempt to access actual data values.
- Generate queries using only the column names shown above."""


def validate_ai_response_does_not_leak(
    ai_response: str,
    schema: Dict[str, Any],
) -> bool:
    """
    Basic check that AI response doesn't contain actual data values.
    Returns True if the response is safe.
    """
    # This is a lightweight check - for production, use more sophisticated
    # pattern matching against known sensitive columns
    sensitive_patterns = [
        "password", "secret", "token", "ssn", "credit_card",
        "api_key", "private_key"
    ]

    response_lower = ai_response.lower()
    for pattern in sensitive_patterns:
        if pattern in response_lower:
            return False

    return True

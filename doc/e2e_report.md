# Local E2E Run Report

## Commands
```bash
python -m pytest -q
python src/app.py
```

## Coverage
- Multi-table, relationship-rich in-memory database plus attached `analytics` schema.
- API endpoints for schema introspection, report execution, and AI suggestion simulation.
- Privacy guardrail: AI path only receives table/column metadata, never row-level data.
- Basic web UI available at `http://localhost:8080/`.

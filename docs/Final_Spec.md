# Final Specification: Self-Hosted Data Analysis & Reporting Utility

## 1. Executive Summary
The organization requires a self-hosted, single-tenant data analysis and reporting utility that integrates directly with PostgreSQL databases. The solution provides manual business intelligence capabilities, an API-first architecture, and optional AI-assisted features. The system is designed to be cost-efficient, relying on open-source components and user-provided LLM API usage.

## 2. Architecture & Tech Stack
Based on the evaluations of different LLM councils, the following architecture is chosen:
- **Backend/Orchestration**: Python with FastAPI.
- **Database**: PostgreSQL (User data and internal metadata).
- **BI Layer**: Metabase OSS.

## 3. Core Functional Requirements
1. **API-First**: All reporting functionality exposed via REST APIs.
2. **Manual BI**: Out-of-the-box support for dashboards, aggregations, filters, and exports via Metabase.
3. **Data Introspection**: Backend can connect to a user-provided Postgres database and extract schema metadata.
4. **AI Assist (BYOK)**: Users provide API keys for OpenAI/Gemini/Anthropic. (Out of scope for initial phase).

## 4. API Endpoints (Initial Implementation)
- `POST /datasources`: Register a new PostgreSQL database connection.
- `GET /datasources/{id}/schema`: Extract and return the schema of the connected database.
- `POST /reports`: Create a new report query definition.
- `GET /reports/{id}/run`: Execute the report and return the data.

## 5. Deployment
- Docker Compose defining 3 core services: backend, metabase, db.

from src.app import create_connection, seed_database, schema_metadata, run_report, Report, simulate_ai_suggestion, home_html


def test_schema_metadata_privacy():
    conn=create_connection(); seed_database(conn)
    data=schema_metadata(conn)
    assert len(data['tables']) >= 5
    assert 'rows' not in data

def test_report_run_aggregation():
    conn=create_connection(); seed_database(conn)
    result=run_report(conn, Report('Revenue','analytics.daily_revenue',{'select':['region'],'aggregations':[{'type':'SUM','field':'revenue'}],'filters':[],'group_by':['region']}))
    assert result['row_count'] == 3
    assert 'LIMIT 1000' in result['sql']

def test_ai_simulation_uses_metadata_only():
    conn=create_connection(); seed_database(conn)
    suggestion=simulate_ai_suggestion('show revenue', schema_metadata(conn))
    assert suggestion['table'] == 'analytics.daily_revenue'
    assert 'metadata_tables_seen' in suggestion

def test_ui_html():
    assert 'Awesome BI Local UI' in home_html()

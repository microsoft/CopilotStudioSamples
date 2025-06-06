import pytest
from py.xml import html

def pytest_html_results_table_header(cells):
    del cells[1]  # Remove the default "Test" column
    cells.insert(1, html.th("User input"))
    cells.insert(2, html.th("Expected"))
    cells.insert(3, html.th("Actual"))
    cells.insert(4, html.th("Score"))
    cells.insert(5, html.th("Reason"))
    cells.insert(6, html.th("Conversation ID"))

def pytest_html_results_table_row(report, cells):
    del cells[1]  # Remove the default "Test" cell
    input_text = getattr(report, 'input_text', '')
    expected = getattr(report, 'expected', '')
    actual = getattr(report, 'actual', '')
    score = getattr(report, 'score', '')
    reason = getattr(report, 'reason', '')
    conversation_id = getattr(report, 'conversation_id', '')

    cells.insert(1, html.td(input_text))
    cells.insert(2, html.td(expected))
    cells.insert(3, html.td(actual, title=actual))
    cells.insert(4, html.td(score))
    cells.insert(5, html.td(reason, title=reason))
    cells.insert(6, html.td(conversation_id))


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    for attr in ["input_text", "expected", "actual", "score", "reason", "conversation_id"]:
        setattr(report, attr, getattr(item, attr, ''))

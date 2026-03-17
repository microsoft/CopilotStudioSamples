from dotenv import load_dotenv
load_dotenv()

import csv
import os
import pytest
import pytest_asyncio
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams
from testinglib.copilot_client import CopilotStudioClient
from microsoft_agents.activity import ActivityTypes

# Load test cases from CSV
def load_test_cases_from_csv():
    csv_path = os.path.join(os.path.dirname(__file__), "../input/test_cases.csv")
    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        return [(row["input_text"], row["expected_output"]) for row in reader]

test_cases = load_test_cases_from_csv()

@pytest_asyncio.fixture(scope="session")
async def started_client():
    client = CopilotStudioClient()
    async for activity in client.client.start_conversation():
        if client.client._current_conversation_id:
            break
    client.conversation_id = client.client._current_conversation_id
    print(f"[DEBUG] Started conversation with ID: {client.conversation_id}")
    return client

@pytest.mark.asyncio
@pytest.mark.parametrize("input_text, expected_output", test_cases)
async def test_answer_relevancy(input_text, expected_output, started_client, request):
    actual_output = ""
    async for activity in started_client.client.ask_question(input_text):
        if activity and activity.type == ActivityTypes.message:
            actual_output += activity.text or ""

    test_case = LLMTestCase(
        input=input_text,
        actual_output=actual_output.strip(),
        expected_output=expected_output
    )

    metric = GEval(
        name="Correctness",
        evaluation_steps=[
            "Check whether the facts in 'actual output' contradict any facts in 'expected output'",
            "You should also heavily penalize omission of detail",
            "Vague language, or contradicting OPINIONS, are OK",
            "Do not penalize disclaimers about AI-generated content being possibly incorrect",
        ],
        threshold=0.50,
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT]
    )
    metric.measure(test_case)

    # Attach to pytest-html report
    request.node.input_text = input_text
    request.node.expected = expected_output
    request.node.actual = actual_output.strip()
    request.node.reason = metric.reason
    request.node.score = f"{metric.score:.2f}"
    request.node.conversation_id = started_client.conversation_id

    assert metric.score >= metric.threshold, f"Score: {metric.score:.2f}, Reason: {metric.reason}"

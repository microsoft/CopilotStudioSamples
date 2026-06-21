from flask import Flask, request, jsonify
import os
from openai import AzureOpenAI

app = Flask(__name__)

client = AzureOpenAI(
    api_key="xxx",
    api_version="xxx",
    azure_endpoint="xxx"
)

@app.route('/chat', methods=['POST'])
def chat():
    user_content = request.json.get('content')
    if not user_content:
        return jsonify({'error': 'No content provided.'}), 400

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Assistant is a large language model trained by OpenAI."},
            {"role": "user", "content": user_content}
        ]
    )

    return jsonify({'response': response.choices[0].message.content})

import time

@app.route('/code', methods=['POST'])
def code():
    user_content = request.json.get('content')
    file = client.files.create(file=open("data.csv", "rb"), purpose="assistants")

    assistant = client.beta.assistants.create(
        instructions="You are an AI assistant that can write code to help answer math questions.",
        model="gpt-4o",
        tools=[{"type": "code_interpreter"}],
        tool_resources={"code_interpreter": {"file_ids": [file.id]}}
    )

    # Create a new thread
    thread = client.beta.threads.create()

    # Place your first message into your thread
    client.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=user_content,
    )

    # Create a run
    run = client.beta.threads.runs.create(
        thread_id=thread.id,
        assistant_id=assistant.id,
    )

    # Wait for your run to finish
    while True:
        run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)

        if run.status == "completed":
            messages = client.beta.threads.messages.list(thread_id=thread.id)
            messages_list = []
            for message in messages:
                messages_list.append(message)
            last_message = messages_list[0]

            client.beta.assistants.delete(assistant.id)
            client.beta.threads.delete(thread.id)
            break
        elif run.status == "requires_action":
            pass
        elif run.status in ["expired", "failed", "cancelled"]:
            break
    return jsonify({'response': last_message.content[0].text.value})    

if __name__ == '__main__':
    app.run(debug=True)
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

# enable logging for Microsoft Agents library
# for more information, see README.md for Quickstart Agent
import logging
ms_agents_logger = logging.getLogger("microsoft_agents")
ms_agents_logger.addHandler(logging.StreamHandler())
ms_agents_logger.setLevel(logging.INFO)

from src.theme_dropdown import create_theme_dropdown  # noqa: F401
import sys
from os import environ
import asyncio
import webbrowser
import time
import pandas as pd
import gradio as gr
import pandas as pd
import numpy as np
from src.AgentProcessor import AgentProcessor
from dotenv import load_dotenv
from msal import PublicClientApplication

from microsoft_agents.activity import ActivityTypes, load_configuration_from_env
from microsoft_agents.copilotstudio.client import (
    ConnectionSettings,
    CopilotClient,
)

from .local_token_cache import LocalTokenCache

logger = logging.getLogger(__name__)
load_dotenv()
TOKEN_CACHE = LocalTokenCache("./.local_token_cache.json")
resultsdf = pd.DataFrame(columns=['Serial', 'Query', 'Response', 'Time', 'ConversationId', 'Char-Len'])
resultsaidf = pd.DataFrame(columns=['Serial', 'Query', 'PlannerStep', 'Thought', 'Tool', 'Arguments'])
statsdf = pd.DataFrame(columns=['Serial', 'Mean', 'Median', 'Max', 'Min', 'Deviation'])
    
async def open_browser(url: str):
    logger.debug(f"Opening browser at {url}")
    await asyncio.get_event_loop().run_in_executor(None, lambda: webbrowser.open(url))


def acquire_token(settings: ConnectionSettings, app_client_id, tenant_id):
    pca = PublicClientApplication(
        client_id=app_client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
        token_cache=TOKEN_CACHE,
    )

    token_request = {
        "scopes": ["https://api.powerplatform.com/.default"],
    }
    accounts = pca.get_accounts()
    retry_interactive = False
    token = None
    try:
        if accounts:
            response = pca.acquire_token_silent(
                token_request["scopes"], account=accounts[0]
            )
            token = response.get("access_token")
        else:
            retry_interactive = True
    except Exception as e:
        retry_interactive = True
        logger.error(
            f"Error acquiring token silently: {e}. Going to attempt interactive login."
        )

    if retry_interactive:
        logger.debug("Attempting interactive login...")
        response = pca.acquire_token_interactive(**token_request)
        token = response.get("access_token")

    return token

def create_client():
    settings = ConnectionSettings(
        environment_id=environ.get("COPILOTSTUDIOAGENT__ENVIRONMENTID"),
        agent_identifier=environ.get("COPILOTSTUDIOAGENT__SCHEMANAME"),
        cloud=None,
        copilot_agent_type=None,
        custom_power_platform_cloud=None,
    )
    
    token = acquire_token(
        settings,
        app_client_id=environ.get("COPILOTSTUDIOAGENT__AGENTAPPID"),
        tenant_id=environ.get("COPILOTSTUDIOAGENT__TENANTID"),
    )
    copilot_client = CopilotClient(settings, token)
    return copilot_client


async def ainput(string: str) -> str:
    await asyncio.get_event_loop().run_in_executor(
        None, lambda s=string: sys.stdout.write(s + " ")
    )
    return await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
      
with gr.Blocks(theme='shivi/calm_seafoam') as demo:
    with gr.Row():
        gr.Markdown("# Copilot Studio Response Analysis Tool")

    with gr.Tab("Statistics"):
        with gr.Row():
            btn = gr.Button("Start Test Run", variant="primary")
        
        gr.Markdown("## Process Status")
        with gr.Row():    
            process_status = gr.Textbox(label="Process Status", interactive=False)
        gr.Markdown("## Response Statistics")
        
        with gr.Row():
            mean_output = gr.Number(label="Mean")
            median_output = gr.Number(label="Median")
            max_output = gr.Number(label="Max")
            min_output = gr.Number(label="Min")
            dev_output = gr.Number(label="Deviation")
            dev_corr = gr.Number(label="Token Corr")
            
        with gr.Row():
            gr.Markdown("## Response Time Analysis")  
        with gr.Row(): 
            lineplot_output = gr.LinePlot(resultsdf, x="Serial", y="Time", title="Response Time per Query", x_label="Query Serial", y_label="Response Time (seconds)", width=800, height=400)
            output_plot_whisker = gr.Plot()

    with gr.Tab("Data", interactive=False) as tb:
        # Applying style to highlight the maximum value in each row
        with gr.Row():
            gr.Markdown("## Query Response / Time Data")
        with gr.Row():
            frame_output = gr.DataFrame(wrap=True,  # Enable text wrapping within cells
                                        label="Query Response / Time Data", 
                                        column_widths=["3%", "30%", "45%", "11%", "11%"], 
                                        show_search="filter")
        with gr.Row():
            gr.Markdown("## LLM Planner Steps Data")
        with gr.Row():    
            frameai_output = gr.DataFrame(wrap=True,  # Enable text wrapping within cells
                                        label="LLM Planner Steps Data", 
                                        column_widths=["3%", "20%", "10%", "25%", "12%", "30%"], 
                                        show_search="filter")

    proc = AgentProcessor("AgentProcessor", create_client())

    btn.click(
        fn=proc.ask_question_file,
        inputs=[],
        outputs=[btn, 
                 tb,
                 process_status, 
                 mean_output, 
                 median_output, 
                 max_output, 
                 min_output, 
                 dev_output, 
                 lineplot_output, 
                 frame_output, 
                 frameai_output, 
                 dev_corr,
                 output_plot_whisker]
        )
    
if __name__ == "__main__":
    demo.launch()
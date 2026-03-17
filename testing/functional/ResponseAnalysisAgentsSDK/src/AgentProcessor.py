import gradio as gr
import time
import pandas as pd
from microsoft_agents.activity import ActivityTypes, load_configuration_from_env
from microsoft_agents.copilotstudio.client import (
    ConnectionSettings,
    CopilotClient,
)
import matplotlib.pyplot as plt
import numpy as np
resultsdf = pd.DataFrame(columns=['Serial', 'Query', 'Response', 'Time','Char-Len'])
resultsaidf = pd.DataFrame(columns=['Serial', 'Query', 'PlannerStep', 'Thought', 'Tool', 'Arguments'])
import sys

class AgentProcessor:
    def __init__(self, name, connection):
        self.name = name
        self.connection = connection

    @property
    def data(self):
        print("Getting data...")
        return self._value

    def merge_dataframes(self, data):   
        # Merge the two DataFrames on the 'Serial' column
        #aggregated_df = data.groupby('Query', as_index=False).agg(
        #    Steps=('Serial', 'count'),
        #    Planner=('PlannerStep', '\n'.join),
        #    Thought=('Thought', ''.join),
        #    Tool=('Tool', lambda x: ', '.join(x.unique())),
        #    Arguments=('Arguments', ''.join)
        #)
        return data
        #return aggregated_df

    def extract_and_format_json_data(self,list_of_dicts, keys_to_extract, separator=","):
        if not isinstance(list_of_dicts, list) or not list_of_dicts:
            return ""
        formatted_items = []
        for item in list_of_dicts:
            # Build the list of key-value pair strings for the current dictionary
            key_value_pairs = [
                f"{key}: {item.get(key, 'N/A')}" for key in keys_to_extract
            ]
            # Join the key-value pairs for the current dictionary
            formatted_items.append(separator.join(key_value_pairs))

        # Join the formatted strings for all dictionaries
        return " \n ".join(formatted_items)

    def generate_boxplot(self, data):
        # Create the figure and axis objects
        fig, ax = plt.subplots()
        
        # Generate the box plot
        ax.boxplot([data], labels=['Response Times'])
        
        # Set plot title and labels
        ax.set_title("Response Time Box Plot")
        ax.set_xlabel("Query")
        ax.set_ylabel("Values")
        ax.set_axis_on()
        ax.set_facecolor('white')
        # You can also add grid lines for better readability
        ax.yaxis.grid(True)
        return fig
    
    def extract_and_format_json_data_without_keys(self, jsoncat):
        result = ""
        for item in jsoncat:
            result += str(item) + "\n"
        return result
    
    async def ask_question_file(self):
        try:
            linecount = 0
            querycounter = 0
            act = self.connection.start_conversation(True)
            print("\nSuggested Actions: ")
            async for action in act:
                if action.text:
                    print(action.text)
            with (open('./data/input.txt', 'r', encoding='utf-8') as file):
                for line in file:
                    linecount = sum(1 for _ in file)
                print(f"\nTotal lines in file: {linecount}\n")
            resultsaidf.drop(index=resultsaidf.index, inplace=True)
            resultsdf.drop(index=resultsdf.index, inplace=True)
            yield (
                gr.update(interactive=False),
                gr.update(interactive=True),
                "STARTED PROCESSING " + str(linecount) + " UTTERANCE(S).",
                0,
                0,
                0,
                0,
                0,
                resultsaidf,
                resultsdf,
                resultsaidf,
                0,
                self.generate_boxplot(resultsdf['Time']) if not resultsdf.empty else plt.figure()
            )
                # Iterate through each line in the file
            with (open('./data/input.txt', 'r', encoding='utf-8') as file):
                for line in file:
                    time.sleep(10)  # Process each line (e.g., print it, manipulate it)
                    query = line.strip() # .strip() removes leading/trailing whitespace, including the newline character
                    querycounter = 1 if querycounter == 0 else querycounter + 1
                    print(f" - {query}" + " : Processing line " + str(querycounter) + " of " + str(linecount))
                    if query in ["exit", "quit", "EXIT"]:
                        timestamp_str = time.strftime("%Y-%m-%d_%H-%M-%S")
                        # Construct the filename with a desired extension
                        filename = f"{action.conversation.id}_{timestamp_str}.csv"
                        # index=False prevents writing the DataFrame index as a column in the CSV
                        resultsdf.to_csv(f"./data/{filename}", sep=',', index=False, quotechar='"', encoding='utf-8')
                        print(f"CSV file '{filename}' created successfully.")
                        yield (
                            gr.update(interactive=True),
                            gr.update(interactive=True),  
                            "PROCESSING " + str(linecount) + " of " + str(len(resultsdf)) + " UTTERANCE(S) FOR CONVERSATION " + action.conversation.id,
                            resultsdf['Time'].mean().round(2),
                            resultsdf['Time'].median().round(2),
                            resultsdf['Time'].max().round(2),
                            resultsdf['Time'].min().round(2),
                            resultsdf['Time'].std().round(2),
                            resultsdf.sort_index(),
                            resultsdf.sort_index(),
                            self.merge_dataframes(resultsaidf.sort_index()),
                            resultsdf['Char-Len'].corr(resultsdf['Time']) if len(resultsdf) > 1 else 0,
                            self.generate_boxplot(resultsdf['Time']) if not resultsdf.empty else plt.figure()
                        )
                        print("Exiting...")
                        break
                    if query not in ["exit", "quit", "EXIT"]:
                        print(f" - {query}" + " : Sending to agent...")
                        start_time = time.perf_counter()
                        replies = self.connection.ask_question(query, action.conversation.id)
                        async for reply in replies:
                            if reply.type == ActivityTypes.event:  
                                print(f": Receiving activity from agent...")   # print(f" - {reply}")
                                if reply.value_type == "DynamicPlanReceived":
                                    resultsaidf.loc[len(resultsaidf)] = [querycounter, 
                                                                         query, 
                                                                         reply.value_type, 
                                                                         self.extract_and_format_json_data(reply.value['toolDefinitions'], ['displayName', 'description']),
                                                                         self.extract_and_format_json_data(reply.value['toolDefinitions'], ['schemaName']) +  self.extract_and_format_json_data_without_keys(reply.value['steps']),
                                                                         '']
                                if reply.value_type == "DynamicPlanStepTriggered":
                                    resultsaidf.loc[len(resultsaidf)] = [querycounter, 
                                                                         query, 
                                                                         reply.value_type, 
                                                                         reply.value['thought'], 
                                                                         reply.value['taskDialogId'], 
                                                                         '']
                                elif reply.value_type == "DynamicPlanStepBindUpdate":
                                    resultsaidf.loc[len(resultsaidf)] = [querycounter, 
                                                                         query, 
                                                                         reply.value_type, 
                                                                         '', 
                                                                         reply.value['taskDialogId'], 
                                                                         str(reply.value['arguments'])]
                                elif reply.value_type == "DynamicPlanStepFinished":
                                    resultsaidf.loc[len(resultsaidf)] = [querycounter, 
                                                                         query, 
                                                                         reply.value_type, 
                                                                         '', 
                                                                         reply.value['taskDialogId'], 
                                                                         '']    
                            elif reply.type == ActivityTypes.message:
                                print(f" - {reply.text}" + " : Receiving reply from agent...")   
                                end_time = time.perf_counter()   
                                elapsed_time = end_time - start_time
                                print(f"Total time taken: {elapsed_time:.6f} seconds")
                                resultsdf.loc[len(resultsdf)] = [querycounter, query, reply.text, elapsed_time.__round__(2), 0 if reply.text is None else len(reply.text)]
                                yield (
                                    gr.update(interactive=False),
                                    gr.update(interactive=True),
                                    "Processing " + str(len(resultsdf)) + " of " + str(linecount) + " records for conversation " + action.conversation.id,
                                    resultsdf['Time'].mean().round(2),
                                    resultsdf['Time'].median().round(2),
                                    resultsdf['Time'].max().round(2),
                                    resultsdf['Time'].min().round(2),
                                    resultsdf['Time'].std().round(2),
                                    resultsdf.sort_index(),
                                    resultsdf.sort_index(),
                                    self.merge_dataframes(resultsaidf.sort_index()),
                                    resultsdf['Char-Len'].corr(resultsdf['Time']),
                                    self.generate_boxplot(resultsdf['Time']) if not resultsdf.empty else plt.figure()
                                )
                                print(f" - Reply recorded: ")
                                if reply.suggested_actions:
                                    for action in reply.suggested_actions.actions:
                                        print(f" - {action.title}")
                            elif reply.type == ActivityTypes.end_of_conversation:
                                print("\nEnd of conversation.")
                                break
            yield (
                gr.update(interactive=True),
                gr.update(interactive=True),
                "PROCESSED " + str(linecount) + " of " + str(linecount) + " UTTERANCE(S) FOR CONVERSATION " + action.conversation.id,
                resultsdf['Time'].mean().round(2),
                resultsdf['Time'].median().round(2),
                resultsdf['Time'].max().round(2),
                resultsdf['Time'].min().round(2),
                resultsdf['Time'].std().round(2),
                resultsdf.sort_index(),
                resultsdf.sort_index(),
                self.merge_dataframes(resultsaidf.sort_index()),
                resultsdf['Char-Len'].corr(resultsdf['Time']) if len(resultsdf) > 1 else 0,
                self.generate_boxplot(resultsdf['Time']) if not resultsdf.empty else plt.figure()
            )   
        except Exception as e:
            print(f"Error: {e}")
            yield (
                gr.update(interactive=True),
                gr.update(interactive=True),     
                f"Error: {e}" + " - Exiting..." + str(len(resultsdf)) + " of " + str(linecount) + " records." + "\n" + e.__traceback__.tb_frame.f_code.co_name + " - " + str(e.__traceback__.tb_lineno),
                resultsdf['Time'].mean().round(2) if not resultsdf.empty else 0,
                resultsdf['Time'].median().round(2) if not resultsdf.empty else 0,
                resultsdf['Time'].max().round(2) if not resultsdf.empty else 0,
                resultsdf['Time'].min().round(2) if not resultsdf.empty else 0,
                resultsdf['Time'].std().round(2) if not resultsdf.empty else 0,
                resultsdf.sort_index() if not resultsdf.empty else pd.DataFrame(),
                resultsdf.sort_index() if not resultsdf.empty else pd.DataFrame(),
                self.merge_dataframes(resultsaidf.sort_index()) if not resultsaidf.empty else pd.DataFrame(),
                resultsdf['Char-Len'].corr(resultsdf['Time']) if len(resultsdf) > 1 else 0,
                self.generate_boxplot(resultsdf['Time']) if not resultsdf.empty else plt.figure()
            )
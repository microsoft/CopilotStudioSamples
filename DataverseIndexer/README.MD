# Dataverse Indexer

Sample solution showing how to index the content of a SharePoint library into a Copilot Studio agent as knowledge source files, along with a workaround to get nice citations that point to the source files in SharePoint.

Benefits for this approach:
1.	Faster latency to get response.
2.	Better indexing to search for content and summarize answers.
3.	Embedded [image understanding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-add-file-upload#annotated-image-support-preview) for PDF files.
4.	Support for [more](https://learn.microsoft.com/microsoft-copilot-studio/knowledge-add-file-upload#supported-document-types) file types.
5.	Support files up to 512 MB.
6.	Clickable citations that point to the source file.
7.	Can work unauthenticated..

Downsides:
1.	No role-based access control – users of the agent have access to generated answers used with content from the uploaded files.
2.	Need to refresh the files (re-run / schedule the flow) to push updates from SharePoint to Copilot Studio.

Instructions:
1.	Import solution on your target environment (can be different from the one hosting your Copilot Studio agent).
2.	Update environment variables for the mandatory inputs.
3.	In your Copilot Studio agent, update the Conversation boosting topic with the provided YAML (make a backup of your current YAML for peace of mind, especially if you had customized the default behavior).
4.	Make sure the cloud flow is turned on
5.	Run the cloud flow.

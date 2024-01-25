
# Microsoft Copilot Studio Samples

## Overview

This repository contains samples and artifacts for Microsoft Copilot Studio.

## Useful links for Microsoft Copilot Studio

| Description | Link |
| --- | --- |
| Home page | [aka.ms/CopilotStudio](https://aka.ms/CopilotStudio) |
| Official blog | [aka.ms/CopilotStudioBlog](https://aka.ms/CopilotStudioBlog) |
| Community forum | [aka.ms/CopilotStudioCommunity](https://aka.ms/CopilotStudioCommunity) |
| Product documentation | [aka.ms/CopilotStudioDocs](https://aka.ms/CopilotStudioDocs) |
| Guidance documentation | [aka.ms/CopilotStudioGuidance](https://aka.ms/CopilotStudioGuidance) |
| GitHub repository of samples | [aka.ms/CopilotStudioSamples](https://aka.ms/CopilotStudioSamples) |
| Demo Copilot Studio | [aka.ms/CopilotStudioDemo](https://aka.ms/CopilotStudioDemo) |
| Try Copilot Studio | [aka.ms/TryCopilotStudio](https://aka.ms/TryCopilotStudio) |

## Samples list

| Sample Name | Description | View |
| --- | --- | --- |
| BotConnectorApp | Demonstrates how to connect your bot to a custom app for example mobile-device app   | [View][cs#1]|
| BuildYourOwnCanvasSamples | Demonstrates how to connect your bot to a custom canvas with various functionality | [View][cs#2] |
| ConnectToEngagementHub | Demonstrates how to detect a handoff activity during a bot conversation and read conversation context | [View][cs#3] |
| CustomAnalytics | This solution allows customers to create a custom Power BI dashboard on top of their copilots analytics data | [View][cs#4] |
| HumanVerificationSample | Identify if the user on the other side is a human or a bot by sending an email to the user with a verification code | [View][cs#5] |
| ImplementationGuide | The implementation guide document provides a framework to do a 360-degree review of a Copilot Studio project. Through probing questions, it highlights potential risks and gaps, aims at aligning the project with the product roadmap, and shares guidance, best practices and reference architecture examples | [View][cs#6] |
| MultilingualBotSample | Sample implementation of a middleware translation relay bot to do real-time translations using Azure services | [View][cs#7] |
| RelayBotSample | Demonstrates how to connect your bot to existing Azure Bot Service channels | [View][cs#8] |
| SharePointSSOComponent | A Sharepoint component demonstrating how copilots can be deployed to SharePoint sites with SSO enabled | [View][cs#9] |
| TestFramework | Run tests against a bot using Direct Line channel and validate that the bot works as expected | [View][cs#10] |


[cs#1]:./BotConnectorApp
[cs#2]:./BuildYourOwnCanvasSamples
[cs#3]:./ConnectToEngagementHub
[cs#4]:./CustomAnalytics
[cs#5]:./HumanVerificationSample
[cs#6]:./ImplementationGuide
[cs#7]:./MultilingualBotSample
[cs#8]:./RelayBotSample
[cs#9]:./SharePointSSOComponent
[cs#10]:./PVATestFramework

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Support

Although the underlying features and components used to build these samples are fully supported (such as Copilot Studio bots, Power Platform products and capabilities, etc.), the samples themselves represent example implementations of these features. Our customers, partners, and community can use and customize these features to implement capabilities in their organizations.

If you face issues with:

- **Using the samples**: Report your issue here: [aka.ms/CopilotStudioSamplesIssues](https://aka.ms/CopilotStudioSamplesIssues). (Microsoft Support won't help you with issues related to the samples, but they will help with related, underlying platform and feature issues.)
- **The core Microsoft features**: Use your standard channel to contact Microsoft Support: [Community help and support for Microsoft Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/fundamentals-support).

## Microsoft Open Source Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).

Resources:

- [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/)
- [Microsoft Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
- Contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with questions or concerns

## Trademarks 
This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow Microsoft's Trademark & Brand Guidelines. Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party's policies.

## Security

Microsoft takes the security of our software products and services seriously, which includes all source code repositories managed through our GitHub organizations, which include [Microsoft](https://github.com/Microsoft), [Azure](https://github.com/Azure), [DotNet](https://github.com/dotnet), [AspNet](https://github.com/aspnet), [Xamarin](https://github.com/xamarin), and [our GitHub organizations](https://opensource.microsoft.com/).

If you believe you have found a security vulnerability in any Microsoft-owned repository that meets Microsoft's [Microsoft's definition of a security vulnerability](https://docs.microsoft.com/en-us/previous-versions/tn-archive/cc751383(v=technet.10)), please report it to us as described below.

## Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them to the Microsoft Security Response Center (MSRC) at [https://msrc.microsoft.com/create-report](https://msrc.microsoft.com/create-report).

If you prefer to submit without logging in, send email to [secure@microsoft.com](mailto:secure@microsoft.com).  If possible, encrypt your message with our PGP key; please download it from the the [Microsoft Security Response Center PGP Key page](https://www.microsoft.com/en-us/msrc/pgp-key-msrc).

You should receive a response within 24 hours. If for some reason you do not, please follow up via email to ensure we received your original message. Additional information can be found at [microsoft.com/msrc](https://www.microsoft.com/msrc).

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

  * Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
  * Full paths of source file(s) related to the manifestation of the issue
  * The location of the affected source code (tag/branch/commit or direct URL)
  * Any special configuration required to reproduce the issue
  * Step-by-step instructions to reproduce the issue
  * Proof-of-concept or exploit code (if possible)
  * Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

If you are reporting for a bug bounty, more complete reports can contribute to a higher bounty award. Please visit our [Microsoft Bug Bounty Program](https://microsoft.com/msrc/bounty) page for more details about our active programs.

## Preferred Languages

We prefer all communications to be in English.

## Policy

Microsoft follows the principle of [Coordinated Vulnerability Disclosure](https://www.microsoft.com/en-us/msrc/cvd).

Copyright (c) Microsoft Corporation. All rights reserved.

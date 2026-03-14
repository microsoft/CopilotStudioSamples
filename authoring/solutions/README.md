# Power Platform Solutions

Importable Power Platform solutions in PnP format. Each solution includes packaged zips and unpacked source code.

## Contents

| Folder | Description |
|--------|-------------|
| [account-contact-lookup/](./account-contact-lookup/) | Multi-agent Dataverse account and contact lookup |
| [auto-detect-language/](./auto-detect-language/) | Automatically detect user language |
| [dataverse-indexer/](./dataverse-indexer/) | Index Dataverse tables for agent knowledge |
| [feedback-analyzer/](./feedback-analyzer/) | Analyze agent conversation feedback with MDA and workflows |
| [generative-chitchat/](./generative-chitchat/) | Generative AI chitchat component |
| [resume-job-finder/](./resume-job-finder/) | Match uploaded resumes against Dataverse job listings |

## Solution Structure

Each solution follows the [PnP format](https://github.com/pnp/powerplatform-samples):

```
solution-name/
├── README.md       # Documentation with badges
├── assets/         # Screenshots and diagrams
├── solution/       # Packaged .zip file(s)
└── sourcecode/     # Unpacked source (pac solution unpack)
```

## Importing Solutions

1. Download the `.zip` from the `solution/` folder
2. Go to [make.powerapps.com](https://make.powerapps.com) > Solutions > Import
3. Select the downloaded zip
4. Configure connection references as prompted
5. Turn on any cloud flows

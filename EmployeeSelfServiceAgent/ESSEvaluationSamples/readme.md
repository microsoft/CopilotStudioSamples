# ESS Agent Evaluation Resources

This repository provides guidance and ready-to-use resources for [evaluating the **Microsoft Employee Self‑Service (ESS)** agent](https://learn.microsoft.com/en-us/copilot/microsoft-365/employee-self-service/evaluations) built in **Copilot Studio**. It is designed to help teams create consistent, repeatable, and scalable evaluation workflows across HR and IT scenarios.

---

## 📘 Overview

Use this repository to:

- Understand how to create test sets for ESS.
- Run automated evaluations using Copilot Studio.
- Interpret evaluation results (accuracy, safety, grounding, completeness, etc.).
- Build a repeatable quality strategy for ESS deployments.
- Develop custom golden query sets for your organization.

The documentation covers:

- **Knowledge tests**
- **Data and topic tests**
- **Conversational quality checks**
- **Recommended practices** for high‑quality ESS evaluation cycles

---

## 📂 Repository Structure

### 1. StarterTestSets (Ready to Use)

Fully prepared test sets you can upload directly into Copilot Studio's Evaluation tool.

- No changes needed.
- Helpful for quick validation, demos, and baseline evaluations.

### 2. TemplatedTestSets (Partially Ready – Requires Input)

These test sets include predefined templates with placeholder values that **you must fill** before use.

Example placeholder:

```Json
What is my employee ID?  Employee ID <21514>

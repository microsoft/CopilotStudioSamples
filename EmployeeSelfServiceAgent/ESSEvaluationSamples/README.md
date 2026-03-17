---
title: Evaluation Samples
parent: Employee Self-Service
nav_order: 3
---
# ESS Agent Evaluation Resources

This repository provides guidance and ready-to-use resources for evaluating the **Microsoft Employee Self‑Service (ESS)** agent built in **Copilot Studio**. It is designed to help teams create consistent, repeatable, and scalable evaluation workflows across HR and IT scenarios.

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

```
What is my employee ID?  Employee ID <21514>
```
Screenshot:

<img width="1116" height="93" alt="image" src="https://github.com/user-attachments/assets/f7cc2673-6d07-4107-812d-e22f47ff4b94" />


Replace values inside `<>` with real test data that matches your environment.

These templates are ideal when:

- You need customizable tests.
- Your org-specific data or IDs differ.
- You want to quickly generate variations of common ESS queries.

### 3. readme.md (You Are Here)

Contains guidance and explanations for effectively using the provided test sets.

---

## 📄 CSV Structure Used in Test Sets

Both **StarterTestSets** and **TemplatedTestSets** follow a consistent CSV format used by Copilot Studio Evaluation.

### CSV Columns

```
Prompt, Expected response, Test Method Type, Passing Score
```

### Example Rows

```
Show me my base salary details, Base salary <Amount + Currency>, CompareMeaning, 70
What is my Cost Center?, Cost center <1234-5678 + Name>, CompareMeaning, 70
```

### Explanation of Columns

- **Prompt** — The user query being tested.  
- **Expected response** — The ideal response pattern the ESS agent should return.  
- **Test Method Type** — Typically `CompareMeaning`, which checks if the agent’s answer semantically matches the expected response.  
- **Passing Score** — Minimum semantic similarity score required to pass (e.g., 70).  

---

## 🚀 How to Use These Test Sets

1. Pick a test set depending on your need:
   - Use **StarterTestSets** for immediate evaluation.
   - Use **TemplatedTestSets** if you want to tailor test data.
2. Upload the CSV files into Copilot Studio’s **Evaluation** tool.
3. Review results across:
   - Response correctness  
   - Safety  
   - Grounding quality  
   - Conversation flow  
4. Iterate and refine the agent or the test sets as needed.

---

## 📚 Additional Documentation

Refer to the official Microsoft documentation for deep guidance on ESS agent evaluations:  
👉 https://learn.microsoft.com/en-us/copilot/microsoft-365/employee-self-service/evaluations

---

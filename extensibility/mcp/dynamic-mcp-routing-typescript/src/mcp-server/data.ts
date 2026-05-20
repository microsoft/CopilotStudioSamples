export interface Instance {
  id: string;
  name: string;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
}

export const instances: Instance[] = [
  {
    id: "contoso",
    name: "Contoso",
    description: "Contoso Ltd — Global ERP transformation programme",
  },
  {
    id: "fabrikam",
    name: "Fabrikam",
    description: "Fabrikam Inc — Supply chain modernisation",
  },
  {
    id: "northwind",
    name: "Northwind",
    description: "Northwind Traders — Finance & HR digital transformation",
  },
];

export const projects: Record<string, Project[]> = {
  contoso: [
    { id: "erp-rollout", name: "ERP Rollout", description: "SAP S/4HANA migration across 12 regions" },
    { id: "data-platform", name: "Data Platform", description: "Enterprise data lake and analytics platform build" },
  ],
  fabrikam: [
    { id: "supply-chain", name: "Supply Chain Optimisation", description: "End-to-end supply chain visibility and automation" },
    { id: "warehouse-automation", name: "Warehouse Automation", description: "Robotics and IoT integration for 8 distribution centres" },
    { id: "vendor-portal", name: "Vendor Portal", description: "Self-service vendor onboarding and management portal" },
  ],
  northwind: [
    { id: "hr-transformation", name: "HR Transformation", description: "Workday implementation and change management" },
    { id: "finance-modernisation", name: "Finance Modernisation", description: "Cloud-based finance platform with real-time reporting" },
  ],
};

export const projectDetails: Record<string, Record<string, object>> = {
  contoso: {
    "erp-rollout": {
      name: "ERP Rollout",
      status: "In Progress — Phase 3 of 5",
      completion: "58%",
      regions: { total: 12, completed: 7, inProgress: 2, pending: 3 },
      nextMilestone: "APAC wave (Q3)",
      risks: [
        "Data migration quality in Singapore entity",
        "Change adoption scores below target in Japan",
      ],
      budget: { allocated: "$48M", spent: "$29M", forecast: "$46M" },
    },
    "data-platform": {
      name: "Data Platform",
      status: "In Progress",
      completion: "80%",
      pipelines: { live: ["SAP", "Salesforce", "ServiceNow"], pending: ["Workday", "Jira"] },
      analyticsLayer: "Databricks — UAT with 3 business units",
      blocker: "PII classification for GDPR compliance pending legal sign-off",
      budget: { allocated: "$12M", spent: "$9.2M", forecast: "$11.5M" },
    },
  },
  fabrikam: {
    "supply-chain": {
      name: "Supply Chain Optimisation",
      status: "Live — partial rollout",
      productLines: { total: 6, live: 4 },
      forecastAccuracy: { before: "72%", after: "89%" },
      logistics: { partners: ["DHL", "FedEx"], integrationStatus: "Final testing" },
      openIssue: "Real-time tracking API latency exceeds SLA for ocean freight",
    },
    "warehouse-automation": {
      name: "Warehouse Automation",
      status: "In Progress",
      distributionCentres: { total: 8, automated: 3, nextUp: "Chicago DC (6 weeks)" },
      results: { throughputIncrease: "40% at Dallas site" },
      iotSensors: "Deployment on track",
    },
    "vendor-portal": {
      name: "Vendor Portal",
      status: "Live",
      vendors: { total: 340, onboarded: 120 },
      onboardingTime: { before: "14 days", after: "3 days" },
      upcoming: "Compliance document upload — next sprint",
    },
  },
  northwind: {
    "hr-transformation": {
      name: "HR Transformation",
      status: "Partially Live",
      platform: "Workday",
      liveModules: ["Core HCM", "Payroll"],
      pendingModules: ["Talent", "Learning"],
      employees: 8500,
      adoptionScore: { current: "76%", target: "80%" },
      risk: "Payroll parallel run discrepancies in UK entity — needs resolution before month-end",
    },
    "finance-modernisation": {
      name: "Finance Modernisation",
      status: "Partially Live",
      platform: "Oracle Fusion",
      liveModules: ["General Ledger", "Accounts Payable"],
      nextQuarter: ["Accounts Receivable", "Fixed Assets"],
      reporting: "Real-time dashboards in pilot with CFO office",
      goal: "Reduce month-end close by 3 days via reconciliation automation",
    },
  },
};

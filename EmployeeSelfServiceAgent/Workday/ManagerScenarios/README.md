---
nav_exclude: true
search_exclude: false
---
# Workday Manager Scenarios

Copilot Studio topics for manager self-service actions in Workday. Topics for a Workday Manager's direct reports must cover all of the supervisory organizations that a manager may have. This requires a list of "supervisory organization IDs" which is provided in the Workday Set User Context topic and backed by a separate SOAP template. 

Modify the Workday Set User Context topic with the following:

```
    - kind: BeginDialog
      id: aV1Wue
      input:
        binding:
          parameters: ="{""params"":[{""key"":""{Employee_ID}"",""value"":""" & Global.ESS_UserContext_Employee_Id & """},{""key"":""{As_Of_Effective_Date}"",""value"":"""& Text(Today(), "yyyy-MM-dd") &"""}]}"
          scenarioName: msdyn_HRWorkdayHCMEmployeeGetData

      dialog: msdyn_copilotforemployeeselfserviceit.topic.WorkdaySystemGetCommonExecution
      output:
        binding:
          errorResponse: Topic.errorResponse
          isSuccess: Topic.isSuccess
          workdayResponse: Topic.workdayResponse

    - kind: ParseValue
      id: 9dxmb5
      variable: Topic.parsedWorkerData
      valueType:
        kind: Record
        properties:
          EmploymentData:
            type:
              kind: Table
              properties:
                Organization_Role_Data:
                  type:
                    kind: Record
                    properties:
                      Organization_Role:
                        type:
                          kind: Record
                          properties:
                            Organization_Role_Data:
                              type:
                                kind: Table
                                properties:
                                  Assignment_From: String
                                  Effective_Date: String
                                  Role_Assigner_Reference:
                                    type:
                                      kind: Record
                                      properties:
                                        @Descriptor: String
                                        ID:
                                          type:
                                            kind: Table
                                            properties:
                                              @type: String
                                              "#text": String

                            Organization_Role_Reference:
                              type:
                                kind: Record
                                properties:
                                  @Descriptor: String
                                  ID:
                                    type:
                                      kind: Table
                                      properties:
                                        @type: String
                                        "#text": String

      value: =Topic.workdayResponse

    - kind: SetVariable
      id: setVariable_VMzjYp
      variable: Global.Manager_Supervisory_OrgIds
      value: |-
        =Concat(
            ForAll(
                First(
                    Filter(
                        Topic.parsedWorkerData.EmploymentData,
                        Organization_Role_Data.Organization_Role.Organization_Role_Reference.'@Descriptor' = "Manager"
                    )
                ).Organization_Role_Data.Organization_Role.Organization_Role_Data,
                First(
                    Filter(
                        Role_Assigner_Reference.ID,
                        '@type' = "Organization_Reference_ID"
                    )
                ).'#text'
            ),
            Value,
            ","
        )
```

Add the the [msdyn_HRWorkdayHCMEmployeeGetData](./msdyn_HRWorkdayHCMEmployeeGetData) SOAP template to the ESS template configuration.

| Folder | Description |
| --- | --- |
| [WorkdayGetManagerReporteesTimeInPosition/](./WorkdayGetManagerReporteesTimeInPosition/) | View reportees' time in position |
|  [WorkdayManagersdirect-CompanyCode](./WorkdayManagersdirect-CompanyCode/) | View reportees' company code details   |
| [WorkdayManagersdirect-CostCenter](./WorkdayManagersdirect-CostCenter/)  | View reportees' cost center details |
| [WorkdayManagersdirect-Jobtaxanomy](./WorkdayManagersdirect-Jobtaxanomy/)  | View details on reportees' job title, position, and other classifications  |
| [WorkdayManagerServiceAnniversary](./WorkdayManagerServiceAnniversary/)  | View details on reportees' upcoming anniversaries   |

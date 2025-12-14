/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const paneId = "SidePaneAgent";

async function openAgent(executionContext) {
    await closeAgent();

    var entityReference = executionContext.getFormContext().entityReference;
    Xrm.App.sidePanes.createPane({
                            title: "Side Pane Agent",
                            imageSrc: "webresources/cat_/sidepaneagent/icon.svg",
                            paneId: paneId,
                            canClose: false
                        }).then((pane) => {
                            pane.navigate({
                                pageType: "webresource",
                                webresourceName: "cat_/sidepaneagent/agent.html",
                                data: "recordType=" + entityReference.entityType + "&id=" + entityReference.id
                            })
                        });
};

async function closeAgent() {
    var pane = await Xrm.App.sidePanes.getPane(paneId);
    if (pane) {
        await pane.close()
    }
}
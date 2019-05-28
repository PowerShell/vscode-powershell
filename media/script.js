/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

const vscode = acquireVsCodeApi();
const parameterSets = document.getElementById("ParameterSets");
const commonParams = document.createElement("div");
commonParams.id = "commonParameters";
let message;
let hasCommonParams = false;

const switchCommonParameters = [
    "Verbose",
    "Debug",
];

const stringCommonParameters = [
    "ErrorAction",
    "WarningAction",
    "InformationAction",
    "ErrorVariable",
    "WarningVariable",
    "InformationVariable",
    "OutVariable",
    "OutBuffer",
    "PipelineVariable",
];

function mySubmit() {
    const myMessage = message;
    myMessage.filledParameters = {};
    parameterSets.childNodes.forEach((node) => {
        if (node.childElementCount > 0 && (node.style.display !== "none" || node.id === "commonParameters")) {
            node.childNodes.forEach((a) => {
                if (a.className === "parameters" && a.value !== "") {
                    const id = a.id.substring(a.id.lastIndexOf("-") + 1, a.id.length);
                    if (a.type === "checkbox") {
                        if (a.checked) {
                            myMessage.filledParameters[id] = "$true";
                        }
                    } else {
                        myMessage.filledParameters[id] = a.value.trim();
                    }
                }
            });
        }
    });
    vscode.postMessage(myMessage);
}

function parameterSetToggle(toggleParameterSet) {
    const psetDivs = parameterSets.getElementsByTagName("div");
    for (let index = 0; index < psetDivs.length; index++) {
        psetDivs[index].style.display = "none";
    }
    document.getElementById(toggleParameterSet).style.display = null;
}

function toggleCommonParameters() {
    const commonParametersDiv = document.getElementById("commonParameters");
    commonParametersDiv.style.display = commonParametersDiv.style.display === "none" ? null : "none";
}

document.getElementById("CommandParameters").onsubmit = mySubmit;
window.addEventListener("message", (event) => {
    message = null;
    let defaultParamSet = "__AllParameterSets";
    // Remove previous nodes if there are any.
    while (parameterSets.hasChildNodes()) {
        parameterSets.removeChild(parameterSets.childNodes[0]);
    }
    message = event.data[0];
    document.getElementById("CommandName").innerText = message.name;
    for (let i = 0; i < message.parameterSets.length; i++) {
        const pSet = message.parameterSets[i];
        if (pSet.isDefault) {
            defaultParamSet = pSet.name;
        }
        const pSetDiv = document.createElement("div");
        pSetDiv.id = pSet.name;
        const setHeader = document.createElement("h3");
        setHeader.innerText = pSet.name;
        setHeader.onclick = (ev) => {
            parameterSetToggle(ev.target.innerText);
        };
        parameterSets.appendChild(setHeader);
        for (let j = 0; j < pSet.parameters.length; j++) {
            const currParameter = pSet.parameters[j];
            if (
                (switchCommonParameters.findIndex((param) => param === currParameter.name) !== -1)
                || (stringCommonParameters.findIndex((param) => param === currParameter.name) !== -1)
            ) {
                hasCommonParams = true;
                continue;
            }
            const parameterLabel = document.createElement("label");
            parameterLabel.htmlFor = pSet.name + "-" + currParameter.name;
            parameterLabel.innerText = currParameter.name;
            let parameterInput = null;
            if (currParameter.attributes[1] === undefined || currParameter.attributes[1].validValues === undefined) {
                parameterInput = document.createElement("input");
                parameterInput.type = currParameter.parameterType.search("SwitchParameter") !== -1 ? "checkbox" : "text";
            } else {
                parameterInput = document.createElement("select");
                parameterInput.appendChild(document.createElement("option"));
                currParameter.attributes[1].validValues.forEach((value) => {
                    const valueElement = document.createElement("option");
                    valueElement.value = value;
                    valueElement.innerText = value;
                    parameterInput.appendChild(valueElement);
                });
            }
            if (pSet.parameters[j].attributes[0].mandatory) {
                parameterLabel.innerText += " *";
                parameterLabel.style = "font-weight: bold";
                parameterInput.required = true;
            }
            parameterInput.className = "parameters";
            parameterInput.id = pSet.name + "-" + currParameter.name;
            pSetDiv.appendChild(parameterLabel);
            pSetDiv.appendChild(parameterInput);
            pSetDiv.appendChild(document.createElement("br"));
        }
        parameterSets.appendChild(pSetDiv);
    }
    if (hasCommonParams) {
        const setHeader = document.createElement("h3");
        setHeader.innerText = "commonParameters";
        setHeader.onclick = toggleCommonParameters;
        parameterSets.appendChild(setHeader);
        switchCommonParameters.forEach((param) => {
            const parameterLabel = document.createElement("label");
            parameterLabel.htmlFor = param;
            parameterLabel.innerText = param;
            const parameterInput = document.createElement("input");
            parameterInput.className = "parameters";
            parameterInput.id = param;
            parameterInput.type = "checkbox";
            commonParams.appendChild(parameterLabel);
            commonParams.appendChild(parameterInput);
            commonParams.appendChild(document.createElement("br"));
        });
        stringCommonParameters.forEach((param) => {
            const parameterLabel = document.createElement("label");
            parameterLabel.htmlFor = param;
            parameterLabel.innerText = param;
            const parameterInput = document.createElement("input");
            parameterInput.className = "parameters";
            parameterInput.id = param;
            parameterInput.type = "text";
            commonParams.appendChild(parameterLabel);
            commonParams.appendChild(parameterInput);
            commonParams.appendChild(document.createElement("br"));
        });
        parameterSets.appendChild(commonParams);
    }
    parameterSetToggle(defaultParamSet);
});

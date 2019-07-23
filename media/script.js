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

function submitCommand() {
    const myMessage = message;
    myMessage.filledParameters = {};
    for (const node of parameterSets.childNodes) {
        if (node.childElementCount > 0 && (node.style.display !== "none" || node.id === "commonParameters")) {
            processParameters(node);
        }
    }
    vscode.postMessage(myMessage);

    function processParameters(node) {
        for (const currNode of node.childNodes) {
            if (currNode.className === "parameters" && currNode.value !== "") {
                const id = currNode.id.substring(currNode.id.lastIndexOf("-") + 1, currNode.id.length);
                if (currNode.type === "checkbox") {
                    if (currNode.checked) {
                        myMessage.filledParameters[id] = "$true";
                    }
                }
                else {
                    myMessage.filledParameters[id] = currNode.value.trim();
                }
            }
        }
    }
}

function parameterSetToggle(toggleParameterSet) {
    const psetDivs = parameterSets.getElementsByTagName("div");
    for (const iterator of psetDivs) {
        iterator.style.display = "none";
    }
    document.getElementById(toggleParameterSet).style.display = null;
}

function toggleCommonParameters() {
    const commonParametersDiv = document.getElementById("commonParameters");
    commonParametersDiv.style.display = commonParametersDiv.style.display === "none" ? null : "none";
}

function processMessage(event) {

    message = null;
    let defaultParamSet = "__AllParameterSets";
    // Remove previous nodes if there are any.
    while (parameterSets.hasChildNodes()) {
        parameterSets.removeChild(parameterSets.childNodes[0]);
    }
    message = event.data[0];
    document.getElementById("CommandName").innerText = message.name;
    for (const pSet of message.parameterSets) {
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
        for (const currParameter of pSet.parameters) {
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
            let validateSet = false;
            let validValues = null;
            for (const currAttribute of currParameter.attributes) {
                if (currAttribute.hasOwnProperty("validValues")) {
                    validateSet = true;
                    validValues = currAttribute.validValues;
                }
            }
            if (!validateSet) {
                parameterInput = document.createElement("input");
                parameterInput.type = currParameter.parameterType.search("SwitchParameter") !== -1 ? "checkbox" : "text";
            } else {
                parameterInput = document.createElement("select");
                parameterInput.appendChild(document.createElement("option"));
                for (const value of validValues) {
                    const valueElement = document.createElement("option");
                    valueElement.value = value;
                    valueElement.innerText = value;
                    parameterInput.appendChild(valueElement);
                }
            }
            if (currParameter.isMandatory) {
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

}

document.getElementById("CommandParameters").onsubmit = submitCommand;

window.addEventListener("message", processMessage);

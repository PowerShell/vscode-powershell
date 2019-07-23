/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

const vscode = acquireVsCodeApi();
const parameterSets = document.getElementById("ParameterSets");
const commonParameters = document.createElement("div");
commonParameters.id = "commonParameters";
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
function processParameter(parameter) {
    const id = parameter.id.substring(parameter.id.lastIndexOf("-") + 1, parameter.id.length);
    if (parameter.type === "checkbox") {
        if (parameter.checked) {
            message.filledParameters[id] = "$true";
        }
    }
    else {
        message.filledParameters[id] = parameter.value.trim();
    }
}

function processParameterSet(parameterSet) {
    for (const currentParameter of parameterSet.childNodes) {
        if (currentParameter.className === "parameters" && currentParameter.value !== "") {
            processParameter(currentParameter);
        }
    }
}

function submitCommand() {
    message.filledParameters = {};

    for (const currentParameterSet of parameterSets.childNodes) {
        if (currentParameterSet.childElementCount > 0 && (currentParameterSet.style.display !== "none" || currentParameterSet.id === "commonParameters")) {
            processParameterSet(currentParameterSet);
        }
    }
    vscode.postMessage(message);


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

    message = event.data[0];
    let defaultParamSet = "__AllParameterSets";
    // Remove previous nodes if there are any.
    while (parameterSets.hasChildNodes()) {
        parameterSets.removeChild(parameterSets.childNodes[0]);
    }
    document.getElementById("CommandName").innerText = message.name;
    for (const currentParameterSet of message.parameterSets) {
        if (currentParameterSet.isDefault) {
            defaultParamSet = currentParameterSet.name;
        }
        const currentParameterSetDiv = document.createElement("div");
        currentParameterSetDiv.id = currentParameterSet.name;
        const currentParameterSetHeader = document.createElement("h3");
        currentParameterSetHeader.innerText = currentParameterSet.name;
        currentParameterSetHeader.onclick = (ev) => {
            parameterSetToggle(ev.target.innerText);
        };
        parameterSets.appendChild(currentParameterSetHeader);
        for (const currentParameter of currentParameterSet.parameters) {
            if (
                (switchCommonParameters.findIndex((param) => param === currentParameter.name) !== -1)
                || (stringCommonParameters.findIndex((param) => param === currentParameter.name) !== -1)
            ) {
                hasCommonParams = true;
                continue;
            }
            const currentParameterLabel = document.createElement("label");
            currentParameterLabel.htmlFor = currentParameterSet.name + "-" + currentParameter.name;
            currentParameterLabel.innerText = currentParameter.name;
            let currentParameterInput = null;
            let currentParameterValidateSet = false;
            let currentParameterValidValues = null;
            for (const currAttribute of currentParameter.attributes) {
                if (currAttribute.hasOwnProperty("validValues")) {
                    currentParameterValidateSet = true;
                    currentParameterValidValues = currAttribute.validValues;
                }
            }
            if (!currentParameterValidateSet) {
                currentParameterInput = document.createElement("input");
                currentParameterInput.type = currentParameter.parameterType.search("SwitchParameter") !== -1 ? "checkbox" : "text";
            } else {
                currentParameterInput = document.createElement("select");
                currentParameterInput.appendChild(document.createElement("option"));
                for (const currentValidValue of currentParameterValidValues) {
                    const currentValidValueElement = document.createElement("option");
                    currentValidValueElement.value = currentValidValue;
                    currentValidValueElement.innerText = currentValidValue;
                    currentParameterInput.appendChild(currentValidValueElement);
                }
            }
            if (currentParameter.isMandatory) {
                currentParameterLabel.innerText += " *";
                currentParameterLabel.style = "font-weight: bold";
                currentParameterInput.required = true;
            }
            currentParameterInput.className = "parameters";
            currentParameterInput.id = currentParameterSet.name + "-" + currentParameter.name;
            currentParameterSetDiv.appendChild(currentParameterLabel);
            currentParameterSetDiv.appendChild(currentParameterInput);
            currentParameterSetDiv.appendChild(document.createElement("br"));
        }
        parameterSets.appendChild(currentParameterSetDiv);
    }
    if (hasCommonParams) {
        const commonParameterSetHeader = document.createElement("h3");
        commonParameterSetHeader.innerText = "commonParameters";
        commonParameterSetHeader.onclick = toggleCommonParameters;
        parameterSets.appendChild(commonParameterSetHeader);
        switchCommonParameters.forEach((param) => {
            const currentParameterLabel = document.createElement("label");
            currentParameterLabel.htmlFor = param;
            currentParameterLabel.innerText = param;
            const parameterInput = document.createElement("input");
            parameterInput.className = "parameters";
            parameterInput.id = param;
            parameterInput.type = "checkbox";
            commonParameters.appendChild(currentParameterLabel);
            commonParameters.appendChild(parameterInput);
            commonParameters.appendChild(document.createElement("br"));
        });
        stringCommonParameters.forEach((param) => {
            const currentParameterLabel = document.createElement("label");
            currentParameterLabel.htmlFor = param;
            currentParameterLabel.innerText = param;
            const currentParameterInput = document.createElement("input");
            currentParameterInput.className = "parameters";
            currentParameterInput.id = param;
            currentParameterInput.type = "text";
            commonParameters.appendChild(currentParameterLabel);
            commonParameters.appendChild(currentParameterInput);
            commonParameters.appendChild(document.createElement("br"));
        });
        parameterSets.appendChild(commonParameters);
    }
    parameterSetToggle(defaultParamSet);

}

document.getElementById("CommandParameters").onsubmit = submitCommand;

window.addEventListener("message", processMessage);

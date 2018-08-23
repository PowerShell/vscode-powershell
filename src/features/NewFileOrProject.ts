/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { LanguageClient, NotificationType, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export class NewFileOrProjectFeature implements IFeature {

    private readonly loadIcon = "  $(sync)  ";
    private command: vscode.Disposable;
    private languageClient: LanguageClient;
    private waitingForClientToken: vscode.CancellationTokenSource;

    constructor() {
        this.command =
            vscode.commands.registerCommand("PowerShell.NewProjectFromTemplate", () => {

                if (!this.languageClient && !this.waitingForClientToken) {

                    // If PowerShell isn't finished loading yet, show a loading message
                    // until the LanguageClient is passed on to us
                    this.waitingForClientToken = new vscode.CancellationTokenSource();
                    vscode.window
                        .showQuickPick(
                            ["Cancel"],
                            { placeHolder: "New Project: Please wait, starting PowerShell..." },
                            this.waitingForClientToken.token)
                        .then((response) => {
                            if (response === "Cancel") {
                                this.clearWaitingToken();
                            }
                        });

                    // Cancel the loading prompt after 60 seconds
                    setTimeout(() => {
                            if (this.waitingForClientToken) {
                                this.clearWaitingToken();

                                vscode.window.showErrorMessage(
                                    "New Project: PowerShell session took too long to start.");
                            }
                        }, 60000);
                } else {
                    this.showProjectTemplates();
                }
            });
    }

    public dispose() {
        this.command.dispose();
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        if (this.waitingForClientToken) {
            this.clearWaitingToken();
            this.showProjectTemplates();
        }
    }

    private showProjectTemplates(includeInstalledModules: boolean = false): void {
        vscode.window
            .showQuickPick(
                this.getProjectTemplates(includeInstalledModules),
                { placeHolder: "Choose a template to create a new project",
                  ignoreFocusOut: true })
            .then((template) => {
                if (template.label.startsWith(this.loadIcon)) {
                    this.showProjectTemplates(true);
                } else {
                    this.createProjectFromTemplate(template.template);
                }
            });
    }

    private getProjectTemplates(includeInstalledModules: boolean): Thenable<ITemplateQuickPickItem[]> {
        return this.languageClient
            .sendRequest(GetProjectTemplatesRequestType, { includeInstalledModules })
            .then((response) => {
                if (response.needsModuleInstall) {
                    // TODO: Offer to install Plaster
                    vscode.window.showErrorMessage("Plaster is not installed!");
                    return Promise.reject<ITemplateQuickPickItem[]>("Plaster needs to be installed");
                } else {
                    let templates = response.templates.map<ITemplateQuickPickItem>(
                        (template) => {
                            return {
                                label: template.title,
                                description: `v${template.version} by ${template.author}, tags: ${template.tags}`,
                                detail: template.description,
                                template,
                            };
                        });

                    if (!includeInstalledModules) {
                        templates =
                            [({
                                label: this.loadIcon,
                                description: "Load additional templates from installed modules",
                                template: undefined,
                            } as ITemplateQuickPickItem)]
                            .concat(templates);
                    } else {
                        templates =
                            [({
                                label: this.loadIcon,
                                description: "Refresh template list",
                                template: undefined,
                            }  as ITemplateQuickPickItem)]
                            .concat(templates);
                    }

                    return templates;
                }
            });
    }

    private createProjectFromTemplate(template: ITemplateDetails): void {
        vscode.window
            .showInputBox(
                { placeHolder: "Enter an absolute path to the folder where the project should be created",
                  ignoreFocusOut: true })
            .then((destinationPath) => {

                if (destinationPath) {
                    // Show the PowerShell session output in case an error occurred
                    vscode.commands.executeCommand("PowerShell.ShowSessionOutput");

                    this.languageClient
                        .sendRequest(
                            NewProjectFromTemplateRequestType,
                            { templatePath: template.templatePath, destinationPath })
                        .then((result) => {
                            if (result.creationSuccessful) {
                                this.openWorkspacePath(destinationPath);
                            } else {
                                vscode.window.showErrorMessage(
                                    "Project creation failed, read the Output window for more details.");
                            }
                        });
                } else {
                    vscode.window
                        .showErrorMessage(
                            "New Project: You must enter an absolute folder path to continue.  Try again?",
                            "Yes", "No")
                        .then((response) => {
                            if (response === "Yes") {
                                this.createProjectFromTemplate(template);
                            }
                        });
                }
            });
    }

    private openWorkspacePath(workspacePath: string) {
        // Open the created project in a new window
        vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.file(workspacePath),
            true);
    }

    private clearWaitingToken() {
        if (this.waitingForClientToken) {
            this.waitingForClientToken.dispose();
            this.waitingForClientToken = undefined;
        }
    }
}

interface ITemplateQuickPickItem extends vscode.QuickPickItem {
    template: ITemplateDetails;
}

interface ITemplateDetails {
    title: string;
    version: string;
    author: string;
    description: string;
    tags: string;
    templatePath: string;
}

export const GetProjectTemplatesRequestType =
    new RequestType<IGetProjectTemplatesRequestArgs, IGetProjectTemplatesResponseBody, string, void>(
        "powerShell/getProjectTemplates");

interface IGetProjectTemplatesRequestArgs {
    includeInstalledModules: boolean;
}

interface IGetProjectTemplatesResponseBody {
    needsModuleInstall: boolean;
    templates: ITemplateDetails[];
}

export const NewProjectFromTemplateRequestType =
    new RequestType<any, INewProjectFromTemplateResponseBody, string, void>(
        "powerShell/newProjectFromTemplate");

interface INewProjectFromTemplateRequestArgs {
    destinationPath: string;
    templatePath: string;
}

interface INewProjectFromTemplateResponseBody {
    creationSuccessful: boolean;
}

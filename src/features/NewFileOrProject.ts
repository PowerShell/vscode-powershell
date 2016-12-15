/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

export class NewFileOrProjectFeature implements IFeature {

    private readonly loadIcon = "  $(sync)  ";
    private command: vscode.Disposable;
    private languageClient: LanguageClient;
    private waitingForClientToken: vscode.CancellationTokenSource;

    constructor() {
        this.command =
            vscode.commands.registerCommand('PowerShell.NewProjectFromTemplate', () => {

                if (!this.languageClient && !this.waitingForClientToken) {

                    // If PowerShell isn't finished loading yet, show a loading message
                    // until the LanguageClient is passed on to us
                    this.waitingForClientToken = new vscode.CancellationTokenSource();
                    vscode.window
                        .showQuickPick(
                            ["Cancel"],
                            { placeHolder: "New Project: Please wait, starting PowerShell..." },
                            this.waitingForClientToken.token)
                        .then(response => { if (response === "Cancel") { this.clearWaitingToken(); } });

                    // Cancel the loading prompt after 60 seconds
                    setTimeout(() => {
                            if (this.waitingForClientToken) {
                                this.clearWaitingToken();

                                vscode.window.showErrorMessage(
                                    "New Project: PowerShell session took too long to start.");
                            }
                        }, 60000);
                }
                else {
                    this.showProjectTemplates();
                }
            });
    }

    public setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        if (this.waitingForClientToken) {
            this.clearWaitingToken();
            this.showProjectTemplates();
        }
    }

    public dispose() {
        this.command.dispose();
    }

    private showProjectTemplates(includeInstalledModules: boolean = false): void {
        vscode.window
            .showQuickPick(
                this.getProjectTemplates(includeInstalledModules),
                { placeHolder: "Choose a template to create a new project",
                  ignoreFocusOut: true })
            .then(template => {
                if (template.label.startsWith(this.loadIcon)) {
                    this.showProjectTemplates(true);
                }
                else {
                    this.createProjectFromTemplate(template.template);
                }
            });
    }

    private getProjectTemplates(includeInstalledModules: boolean): Thenable<TemplateQuickPickItem[]> {
        return this.languageClient
            .sendRequest(
                GetProjectTemplatesRequest.type,
                { includeInstalledModules: includeInstalledModules })
            .then(response => {
                if (response.needsModuleInstall) {
                    // TODO: Offer to install Plaster
                    vscode.window.showErrorMessage("Plaster is not installed!");
                    return Promise.reject<TemplateQuickPickItem[]>("Plaster needs to be installed");
                }
                else {
                    var templates = response.templates.map<TemplateQuickPickItem>(
                        template => {
                            return {
                                label: template.title,
                                description: `v${template.version} by ${template.author}, tags: ${template.tags}`,
                                detail: template.description,
                                template: template
                            }
                        });

                    if (!includeInstalledModules) {
                        templates =
                            [{ label: this.loadIcon, description: "Load additional templates from installed modules", template: undefined }]
                                .concat(templates)
                    }
                    else {
                        templates =
                            [{ label: this.loadIcon, description: "Refresh template list", template: undefined }]
                                .concat(templates)
                    }

                    return templates;
                }
            });
    }

    private createProjectFromTemplate(template: TemplateDetails): void {
        vscode.window
            .showInputBox(
                { placeHolder: "Enter an absolute path to the folder where the project should be created",
                  ignoreFocusOut: true })
            .then(destinationPath => {

                if (destinationPath) {
                    // Show the PowerShell session output in case an error occurred
                    vscode.commands.executeCommand("PowerShell.ShowSessionOutput");

                    this.languageClient
                        .sendRequest(
                            NewProjectFromTemplateRequest.type,
                            { templatePath: template.templatePath, destinationPath: destinationPath })
                        .then(result => {
                            if (result.creationSuccessful) {
                                this.openWorkspacePath(destinationPath);
                            }
                            else {
                                vscode.window.showErrorMessage(
                                    "Project creation failed, read the Output window for more details.");
                            }
                        });
                }
                else {
                    vscode.window
                        .showErrorMessage(
                            "New Project: You must enter an absolute folder path to continue.  Try again?",
                            "Yes", "No")
                        .then(
                            response => {
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

interface TemplateQuickPickItem extends vscode.QuickPickItem {
    template: TemplateDetails
}

interface TemplateDetails {
    title: string;
    version: string;
    author: string;
    description: string;
    tags: string;
    templatePath: string;
}

namespace GetProjectTemplatesRequest {
    export const type: RequestType<GetProjectTemplatesRequestArgs, GetProjectTemplatesResponseBody, string> =
        { get method() { return 'powerShell/getProjectTemplates'; } };
}

interface GetProjectTemplatesRequestArgs {
    includeInstalledModules: boolean;
}

interface GetProjectTemplatesResponseBody {
    needsModuleInstall: boolean;
    templates: TemplateDetails[];
}

namespace NewProjectFromTemplateRequest {
    export const type: RequestType<any, NewProjectFromTemplateResponseBody, string> =
        { get method() { return 'powerShell/newProjectFromTemplate'; } };
}

interface NewProjectFromTemplateRequestArgs {
    destinationPath: string;
    templatePath: string;
}

interface NewProjectFromTemplateResponseBody {
    creationSuccessful: boolean;
}
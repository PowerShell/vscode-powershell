// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");
import { RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { ILogger } from "../logging";

export class NewFileOrProjectFeature extends LanguageClientConsumer {

    private readonly loadIcon = "  $(sync)  ";
    private command: vscode.Disposable;
    private waitingForClientToken?: vscode.CancellationTokenSource;

    constructor(private logger: ILogger) {
        super();
        this.command =
            vscode.commands.registerCommand("PowerShell.NewProjectFromTemplate", async () => {
                if (!this.languageClient && !this.waitingForClientToken) {
                    // If PowerShell isn't finished loading yet, show a loading message
                    // until the LanguageClient is passed on to us
                    this.waitingForClientToken = new vscode.CancellationTokenSource();
                    const response = await vscode.window.showQuickPick(
                        ["Cancel"],
                        { placeHolder: "New Project: Please wait, starting PowerShell..." },
                        this.waitingForClientToken.token);

                    if (response === "Cancel") {
                        this.clearWaitingToken();
                    }

                    // Cancel the loading prompt after 60 seconds
                    setTimeout(() => {
                        if (this.waitingForClientToken) {
                            this.clearWaitingToken();
                            void this.logger.writeAndShowError("New Project: PowerShell session took too long to start.");
                        }
                    }, 60000);
                } else {
                    await this.showProjectTemplates();
                }
            });
    }

    public dispose() {
        this.command.dispose();
    }

    public override setLanguageClient(languageClient: LanguageClient) {
        this.languageClient = languageClient;

        if (this.waitingForClientToken) {
            this.clearWaitingToken();
            void this.showProjectTemplates();
        }
    }

    private async showProjectTemplates(includeInstalledModules = false): Promise<void> {
        const template = await vscode.window.showQuickPick(
            this.getProjectTemplates(includeInstalledModules),
            {
                placeHolder: "Choose a template to create a new project",
                ignoreFocusOut: true
            });

        if (template === undefined) {
            return;
        } else if (template.label.startsWith(this.loadIcon)) {
            await this.showProjectTemplates(true);
        } else if (template.template) {
            await this.createProjectFromTemplate(template.template);
        }
    }

    private async getProjectTemplates(includeInstalledModules: boolean): Promise<ITemplateQuickPickItem[]> {
        if (this.languageClient === undefined) {
            return Promise.reject<ITemplateQuickPickItem[]>("Language client not defined!");
        }

        const response = await this.languageClient.sendRequest(
            GetProjectTemplatesRequestType,
            { includeInstalledModules });

        if (response.needsModuleInstall) {
            // TODO: Offer to install Plaster
            void this.logger.writeAndShowError("Plaster is not installed!");
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
                    } as ITemplateQuickPickItem)]
                        .concat(templates);
            }

            return templates;
        }
    }

    private async createProjectFromTemplate(template: ITemplateDetails): Promise<void> {
        const destinationPath = await vscode.window.showInputBox(
            {
                placeHolder: "Enter an absolute path to the folder where the project should be created",
                ignoreFocusOut: true
            });

        if (destinationPath !== undefined) {
            await vscode.commands.executeCommand("PowerShell.ShowSessionConsole");

            const result = await this.languageClient?.sendRequest(
                NewProjectFromTemplateRequestType,
                { templatePath: template.templatePath, destinationPath });
            if (result?.creationSuccessful) {
                await this.openWorkspacePath(destinationPath);
            } else {
                void this.logger.writeAndShowError("Project creation failed, read the Output window for more details.");
            }
        } else {
            await this.logger.writeAndShowErrorWithActions(
                "New Project: You must enter an absolute folder path to continue. Try again?",
                [
                    {
                        prompt: "Yes",
                        action: async () => { await this.createProjectFromTemplate(template); }
                    },
                    {
                        prompt: "No",
                        action: undefined
                    }
                ]
            );
        }
    }

    private async openWorkspacePath(workspacePath: string) {
        // Open the created project in a new window
        await vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.file(workspacePath),
            true);
    }

    private clearWaitingToken() {
        this.waitingForClientToken?.dispose();
        this.waitingForClientToken = undefined;
    }
}

interface ITemplateQuickPickItem extends vscode.QuickPickItem {
    template?: ITemplateDetails;
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
    new RequestType<IGetProjectTemplatesRequestArgs, IGetProjectTemplatesResponseBody, string>(
        "powerShell/getProjectTemplates");

interface IGetProjectTemplatesRequestArgs {
    includeInstalledModules: boolean;
}

interface IGetProjectTemplatesResponseBody {
    needsModuleInstall: boolean;
    templates: ITemplateDetails[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface INewProjectFromTemplateRequestArguments {
}

export const NewProjectFromTemplateRequestType =
    new RequestType<INewProjectFromTemplateRequestArguments, INewProjectFromTemplateResponseBody, string>(
        "powerShell/newProjectFromTemplate");

interface INewProjectFromTemplateResponseBody {
    creationSuccessful: boolean;
}

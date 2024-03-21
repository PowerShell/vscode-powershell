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

    constructor(private logger: ILogger) {
        super();
        this.command =
            vscode.commands.registerCommand(
                "PowerShell.NewProjectFromTemplate",
                async () => { await this.showProjectTemplates(); });
    }

    public dispose(): void {
        this.command.dispose();
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public override onLanguageClientSet(_languageClient: LanguageClient): void {}

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
        const client = await LanguageClientConsumer.getLanguageClient();
        const response = await client.sendRequest(
            GetProjectTemplatesRequestType,
            { includeInstalledModules });

        if (response.needsModuleInstall) {
            // TODO: Offer to install Plaster
            void this.logger.writeAndShowError("Plaster is not installed!");
            return Promise.reject<ITemplateQuickPickItem[]>(new Error("Plaster needs to be installed"));
        }

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

    private async createProjectFromTemplate(template: ITemplateDetails): Promise<void> {
        const destinationPath = await vscode.window.showInputBox(
            {
                placeHolder: "Enter an absolute path to the folder where the project should be created",
                ignoreFocusOut: true
            });

        if (destinationPath !== undefined) {
            await vscode.commands.executeCommand("PowerShell.ShowSessionConsole");

            const client = await LanguageClientConsumer.getLanguageClient();
            const result = await client.sendRequest(
                NewProjectFromTemplateRequestType,
                { templatePath: template.templatePath, destinationPath });

            if (result.creationSuccessful) {
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
                        action: async (): Promise<void> => { await this.createProjectFromTemplate(template); }
                    },
                    {
                        prompt: "No",
                        action: undefined
                    }
                ]
            );
        }
    }

    private async openWorkspacePath(workspacePath: string): Promise<void> {
        // Open the created project in a new window
        await vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.file(workspacePath),
            true);
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

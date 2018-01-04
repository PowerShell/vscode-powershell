/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require("vscode");
import { LanguageClient, NotificationType, RequestType } from "vscode-languageclient";
import { IFeature } from "../feature";

export class CustomViewsFeature implements IFeature {

    private commands: vscode.Disposable[] = [];
    private languageClient: LanguageClient;
    private contentProvider: PowerShellContentProvider;

    constructor() {
        this.contentProvider = new PowerShellContentProvider();
        this.commands.push(
            vscode.workspace.registerTextDocumentContentProvider(
                "powershell",
                this.contentProvider));
    }

    public dispose() {
        this.commands.forEach((d) => d.dispose());
    }

    public setLanguageClient(languageClient: LanguageClient) {

        languageClient.onRequest(
            NewCustomViewRequestType,
            (args) => {
                this.contentProvider.createView(
                    args.id,
                    args.title,
                    args.viewType);
            });

        languageClient.onRequest(
            ShowCustomViewRequestType,
            (args) => {
                this.contentProvider.showView(
                    args.id,
                    args.viewColumn);
            });

        languageClient.onRequest(
            CloseCustomViewRequestType,
            (args) => {
                this.contentProvider.closeView(args.id);
            });

        languageClient.onRequest(
            SetHtmlContentViewRequestType,
            (args) => {
                this.contentProvider.setHtmlContentView(
                    args.id,
                    args.htmlContent);
            });

        languageClient.onRequest(
            AppendHtmlOutputViewRequestType,
            (args) => {
                this.contentProvider.appendHtmlOutputView(
                    args.id,
                    args.appendedHtmlBodyContent);
            });

        this.languageClient = languageClient;
    }
}

class PowerShellContentProvider implements vscode.TextDocumentContentProvider {

    private count: number = 1;
    private viewIndex: { [id: string]: CustomView } = {};
    private didChangeEvent: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();

    // tslint:disable-next-line:member-ordering
    public onDidChange: vscode.Event<vscode.Uri> = this.didChangeEvent.event;

    public provideTextDocumentContent(uri: vscode.Uri): string {
        return this.viewIndex[uri.toString()].getContent();
    }

    public createView(id: string, title: string, viewType: CustomViewType) {
        let view;
        switch (viewType) {
            case CustomViewType.HtmlContent:
                view = new HtmlContentView(id, title);
        }

        this.viewIndex[this.getUri(view.id)] = view;
    }

    public showView(id: string, viewColumn: vscode.ViewColumn) {
        const uriString = this.getUri(id);
        const view: CustomView = this.viewIndex[uriString];

        vscode.commands.executeCommand(
            "vscode.previewHtml",
            uriString,
            viewColumn,
            view.title);
    }

    public closeView(id: string) {
        const uriString = this.getUri(id);
        const view: CustomView = this.viewIndex[uriString];

        vscode.workspace.textDocuments.some((doc) => {
            if (doc.uri.toString() === uriString) {
                vscode.window
                    .showTextDocument(doc)
                    .then((editor) => vscode.commands.executeCommand("workbench.action.closeActiveEditor"));

                return true;
            }

            return false;
        });
    }

    public setHtmlContentView(id: string, content: IHtmlContent) {
        const uriString = this.getUri(id);
        const view: CustomView = this.viewIndex[uriString];

        if (view.viewType === CustomViewType.HtmlContent) {
            (view as HtmlContentView).setContent(content);
            this.didChangeEvent.fire(vscode.Uri.parse(uriString));
        }
    }

    public appendHtmlOutputView(id: string, content: string) {
        const uriString = this.getUri(id);
        const view: CustomView = this.viewIndex[uriString];

        if (view.viewType === CustomViewType.HtmlContent) {
            (view as HtmlContentView).appendContent(content);
            this.didChangeEvent.fire(vscode.Uri.parse(uriString));
        }
    }

    private getUri(id: string) {
        return `powershell://views/${id}`;
    }
}

abstract class CustomView {

    constructor(
        public id: string,
        public title: string,
        public viewType: CustomViewType) {
    }

    public abstract getContent(): string;
}

class HtmlContentView extends CustomView {

    private htmlContent: IHtmlContent = {
        bodyContent: "",
        javaScriptPaths: [],
        styleSheetPaths: [],
    };

    constructor(
        id: string,
        title: string) {
        super(id, title, CustomViewType.HtmlContent);
    }

    public setContent(htmlContent: IHtmlContent) {
        this.htmlContent = htmlContent;
    }

    public appendContent(content: string) {
        this.htmlContent.bodyContent += content;
    }

    public getContent(): string {
        let styleSrc = "none";
        let styleTags = "";

        function getNonce(): number {
            return Math.floor(Math.random() * 100000) + 100000;
        }

        if (this.htmlContent.styleSheetPaths &&
            this.htmlContent.styleSheetPaths.length > 0) {
            styleSrc = "";
            this.htmlContent.styleSheetPaths.forEach(
                (p) => {
                    const nonce = getNonce();
                    styleSrc += `'nonce-${nonce}' `;
                    styleTags += `<link nonce="${nonce}" href="${p}" rel="stylesheet" type="text/css" />\n`;
                });
        }

        let scriptSrc = "none";
        let scriptTags = "";

        if (this.htmlContent.javaScriptPaths &&
            this.htmlContent.javaScriptPaths.length > 0) {
            scriptSrc = "";
            this.htmlContent.javaScriptPaths.forEach(
                (p) => {
                    const nonce = getNonce();
                    scriptSrc += `'nonce-${nonce}' `;
                    scriptTags += `<script nonce="${nonce}" src="${p}"></script>\n`;
                });
        }

        // Return an HTML page with the specified content
        return `<html><head><meta http-equiv="Content-Security-Policy" ` +
               `content="default-src 'none'; img-src *; style-src ${styleSrc}; script-src ${scriptSrc};">` +
               `${styleTags}</head><body>\n${this.htmlContent.bodyContent}\n${scriptTags}</body></html>`;
    }
}

enum CustomViewType {
    HtmlContent = 1,
}

export const NewCustomViewRequestType =
    new RequestType<INewCustomViewRequestArguments, void, void, void>(
        "powerShell/newCustomView");

interface INewCustomViewRequestArguments {
    id: string;
    title: string;
    viewType: CustomViewType;
}

export const ShowCustomViewRequestType =
    new RequestType<IShowCustomViewRequestArguments, void, void, void>(
        "powerShell/showCustomView");

interface IShowCustomViewRequestArguments {
    id: string;
    viewColumn: vscode.ViewColumn;
}

export const CloseCustomViewRequestType =
    new RequestType<ICloseCustomViewRequestArguments, void, void, void>(
        "powerShell/closeCustomView");

interface ICloseCustomViewRequestArguments {
    id: string;
}

export const SetHtmlContentViewRequestType =
    new RequestType<ISetHtmlContentViewRequestArguments, void, void, void>(
        "powerShell/setHtmlViewContent");

interface IHtmlContent {
    bodyContent: string;
    javaScriptPaths: string[];
    styleSheetPaths: string[];
}

interface ISetHtmlContentViewRequestArguments {
    id: string;
    htmlContent: IHtmlContent;
}

export const AppendHtmlOutputViewRequestType =
    new RequestType<IAppendHtmlOutputViewRequestArguments, void, void, void>(
        "powerShell/appendHtmlViewContent");

interface IAppendHtmlOutputViewRequestArguments {
    id: string;
    appendedHtmlBodyContent: string;
}

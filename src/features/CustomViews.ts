// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import * as vscode from "vscode";
import { RequestType } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";

export class CustomViewsFeature extends LanguageClientConsumer {

    private commands: vscode.Disposable[] = [];
    private contentProvider: PowerShellContentProvider;

    constructor() {
        super();
        this.contentProvider = new PowerShellContentProvider();
        this.commands.push(
            vscode.workspace.registerTextDocumentContentProvider(
                "powershell",
                this.contentProvider));
    }

    public dispose() {
        for (const command of this.commands) {
            command.dispose();
        }
    }

    public override setLanguageClient(languageClient: LanguageClient) {

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
    }
}

class PowerShellContentProvider implements vscode.TextDocumentContentProvider {

    private viewIndex: Record<string, CustomView> = {};
    private didChangeEvent: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();

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
        (this.viewIndex[uriString] as HtmlContentView).showContent(viewColumn);
    }

    public closeView(id: string) {
        const uriString = this.getUri(id);

        vscode.workspace.textDocuments.some((doc) => {
            if (doc.uri.toString() === uriString) {
                void vscode.window.showTextDocument(doc);
                void vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                return true;
            }

            return false;
        });
    }

    public setHtmlContentView(id: string, content: IHtmlContent) {
        const uriString = this.getUri(id);
        const view: CustomView = this.viewIndex[uriString];

        (view as HtmlContentView).setContent(content);
        this.didChangeEvent.fire(vscode.Uri.parse(uriString));
    }

    public appendHtmlOutputView(id: string, content: string) {
        const uriString = this.getUri(id);
        const view: CustomView = this.viewIndex[uriString];

        (view as HtmlContentView).appendContent(content);
        this.didChangeEvent.fire(vscode.Uri.parse(uriString));
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

    private webviewPanel: vscode.WebviewPanel | undefined;

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
        let styleTags = "";
        if (this.htmlContent.styleSheetPaths.length > 0) {
            for (const styleSheetPath of this.htmlContent.styleSheetPaths) {
                styleTags += `<link rel="stylesheet" href="${styleSheetPath.toString().replace("file://", "vscode-resource://")}">\n`;
            }
        }

        let scriptTags = "";
        if (this.htmlContent.javaScriptPaths.length > 0) {
            for (const javaScriptPath of this.htmlContent.javaScriptPaths) {
                scriptTags += `<script src="${javaScriptPath.toString().replace("file://", "vscode-resource://")}"></script>\n`;
            }
        }

        // Return an HTML page with the specified content
        return `<html><head>${styleTags}</head><body>\n${this.htmlContent.bodyContent}\n${scriptTags}</body></html>`;
    }

    public showContent(viewColumn: vscode.ViewColumn): void {
        this.webviewPanel?.dispose();

        let localResourceRoots: vscode.Uri[] = [];
        localResourceRoots = localResourceRoots.concat(this.htmlContent.javaScriptPaths.map((p) => {
            return vscode.Uri.parse(path.dirname(p));
        }));

        localResourceRoots = localResourceRoots.concat(this.htmlContent.styleSheetPaths.map((p) => {
            return vscode.Uri.parse(path.dirname(p));
        }));

        this.webviewPanel = vscode.window.createWebviewPanel(
            this.id,
            this.title,
            viewColumn,
            {
                enableScripts: true,
                enableFindWidget: true,
                enableCommandUris: true,
                retainContextWhenHidden: true,
                localResourceRoots,
            });
        this.webviewPanel.webview.html = this.getContent();
        this.webviewPanel.reveal(viewColumn);
    }
}

enum CustomViewType {
    HtmlContent = 1,
}

export const NewCustomViewRequestType =
    new RequestType<INewCustomViewRequestArguments, void, void>(
        "powerShell/newCustomView");

interface INewCustomViewRequestArguments {
    id: string;
    title: string;
    viewType: CustomViewType;
}

export const ShowCustomViewRequestType =
    new RequestType<IShowCustomViewRequestArguments, void, void>(
        "powerShell/showCustomView");

interface IShowCustomViewRequestArguments {
    id: string;
    viewColumn: vscode.ViewColumn;
}

export const CloseCustomViewRequestType =
    new RequestType<ICloseCustomViewRequestArguments, void, void>(
        "powerShell/closeCustomView");

interface ICloseCustomViewRequestArguments {
    id: string;
}

export const SetHtmlContentViewRequestType =
    new RequestType<ISetHtmlContentViewRequestArguments, void, void>(
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
    new RequestType<IAppendHtmlOutputViewRequestArguments, void, void>(
        "powerShell/appendHtmlViewContent");

interface IAppendHtmlOutputViewRequestArguments {
    id: string;
    appendedHtmlBodyContent: string;
}

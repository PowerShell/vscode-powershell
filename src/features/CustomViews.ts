/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vscode = require('vscode');
import { IFeature } from '../feature';
import { LanguageClient, RequestType, NotificationType } from 'vscode-languageclient';

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

    public setLanguageClient(languageClient: LanguageClient) {

        languageClient.onRequest(
            NewCustomViewRequest.type,
            args => {
                this.contentProvider.createView(
                    args.id,
                    args.title,
                    args.viewType);
            });

        languageClient.onRequest(
            ShowCustomViewRequest.type,
            args => {
                this.contentProvider.showView(
                    args.id,
                    args.viewColumn);
            });

        languageClient.onRequest(
            CloseCustomViewRequest.type,
            args => {
                this.contentProvider.closeView(args.id);
            });

        languageClient.onRequest(
            SetHtmlContentViewRequest.type,
            args => {
                this.contentProvider.setHtmlContentView(
                    args.id,
                    args.htmlContent);
            });

        languageClient.onRequest(
            AppendHtmlOutputViewRequest.type,
            args => {
                this.contentProvider.appendHtmlOutputView(
                    args.id,
                    args.appendedHtmlBodyContent);
            });

        this.languageClient = languageClient;
    }

    public dispose() {
        this.commands.forEach(d => d.dispose());
    }
}

class PowerShellContentProvider implements vscode.TextDocumentContentProvider {

    private count: number = 1;
    private viewIndex: { [id: string]: CustomView } = {};
    private didChangeEvent: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();

    public provideTextDocumentContent(uri: vscode.Uri): string {
        return this.viewIndex[uri.toString()].getContent();
    }

    public createView(id: string, title: string, viewType: CustomViewType) {
        let view = undefined;
        switch (viewType) {
            case CustomViewType.HtmlContent:
                view = new HtmlContentView(id, title);
        };

        this.viewIndex[this.getUri(view.id)] = view;
    }

    public showView(id: string, viewColumn: vscode.ViewColumn) {
        let uriString = this.getUri(id);
        let view: CustomView = this.viewIndex[uriString];

        vscode.commands.executeCommand(
            "vscode.previewHtml",
            uriString,
            viewColumn,
            view.title);
    }

    public closeView(id: string) {
        let uriString = this.getUri(id);
        let view: CustomView = this.viewIndex[uriString];

        vscode.workspace.textDocuments.some(
            doc => {
                if (doc.uri.toString() === uriString) {
                    vscode.window
                        .showTextDocument(doc)
                        .then(editor => vscode.commands.executeCommand("workbench.action.closeActiveEditor"))

                    return true;
                }

                return false;
            }
        )
    }

    public setHtmlContentView(id: string, content: HtmlContent) {
        let uriString = this.getUri(id);
        let view: CustomView = this.viewIndex[uriString];

        if (view.viewType === CustomViewType.HtmlContent) {
            (<HtmlContentView>view).setContent(content);
            this.didChangeEvent.fire(vscode.Uri.parse(uriString));
        }
    }

    public appendHtmlOutputView(id: string, content: string) {
        let uriString = this.getUri(id);
        let view: CustomView = this.viewIndex[uriString];

        if (view.viewType === CustomViewType.HtmlContent) {
            (<HtmlContentView>view).appendContent(content);
            this.didChangeEvent.fire(vscode.Uri.parse(uriString));
        }
    }

    private getUri(id: string) {
        return `powershell://views/${id}`;
    }

    public onDidChange: vscode.Event<vscode.Uri> = this.didChangeEvent.event;
}

abstract class CustomView {

    constructor(
        public id: string,
        public title: string,
        public viewType: CustomViewType)
    {
    }

    abstract getContent(): string;
}

class HtmlContentView extends CustomView {

    private htmlContent: HtmlContent = {
        bodyContent: "",
        javaScriptPaths: [],
        styleSheetPaths: []
    };

    constructor(
        id: string,
        title: string)
    {
        super(id, title, CustomViewType.HtmlContent);
    }

    setContent(htmlContent: HtmlContent) {
        this.htmlContent = htmlContent;
    }

    appendContent(content: string) {
        this.htmlContent.bodyContent += content;
    }

    getContent(): string {
        var styleSrc = "none";
        var styleTags = "";

        function getNonce(): number {
            return Math.floor(Math.random() * 100000) + 100000;
        }

        if (this.htmlContent.styleSheetPaths &&
            this.htmlContent.styleSheetPaths.length > 0) {
            styleSrc = "";
            this.htmlContent.styleSheetPaths.forEach(
                p => {
                    var nonce = getNonce();
                    styleSrc += `'nonce-${nonce}' `;
                    styleTags += `<link nonce="${nonce}" href="${p}" rel="stylesheet" type="text/css" />\n`;
                });
        }

        var scriptSrc = "none";
        var scriptTags = "";

        if (this.htmlContent.javaScriptPaths &&
            this.htmlContent.javaScriptPaths.length > 0) {
            scriptSrc = "";
            this.htmlContent.javaScriptPaths.forEach(
                p => {
                    var nonce = getNonce();
                    scriptSrc += `'nonce-${nonce}' `;
                    scriptTags += `<script nonce="${nonce}" src="${p}"></script>\n`;
                });
        }

        // Return an HTML page with the specified content
        return `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src *; style-src ${styleSrc}; script-src ${scriptSrc};">${styleTags}</head><body>\n${this.htmlContent.bodyContent}\n${scriptTags}</body></html>`;
    }
}

enum CustomViewType {
    HtmlContent = 1,
}

namespace NewCustomViewRequest {
    export const type =
        new RequestType<NewCustomViewRequestArguments, void, void, void>(
            'powerShell/newCustomView');
}

interface NewCustomViewRequestArguments {
    id: string;
    title: string;
    viewType: CustomViewType;
}

namespace ShowCustomViewRequest {
    export const type =
        new RequestType<ShowCustomViewRequestArguments, void, void, void>(
            'powerShell/showCustomView');
}

interface ShowCustomViewRequestArguments {
    id: string;
    viewColumn: vscode.ViewColumn;
}

namespace CloseCustomViewRequest {
    export const type =
        new RequestType<CloseCustomViewRequestArguments, void, void, void>(
            'powerShell/closeCustomView');
}

interface CloseCustomViewRequestArguments {
    id: string;
}

namespace SetHtmlContentViewRequest {
    export const type =
        new RequestType<SetHtmlContentViewRequestArguments, void, void, void>(
            'powerShell/setHtmlViewContent');
}

interface HtmlContent {
    bodyContent: string;
    javaScriptPaths: string[];
    styleSheetPaths: string[];
}

interface SetHtmlContentViewRequestArguments {
    id: string;
    htmlContent: HtmlContent;
}

namespace AppendHtmlOutputViewRequest {
    export const type =
        new RequestType<AppendHtmlOutputViewRequestArguments, void, void, void>(
            'powerShell/appendHtmlViewContent');
}

interface AppendHtmlOutputViewRequestArguments {
    id: string;
    appendedHtmlBodyContent: string;
}

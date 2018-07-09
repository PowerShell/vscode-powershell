/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import fs = require("fs");
import * as path from "path";
import * as vscode from "vscode";
import {
    DocumentSelector,
    LanguageClient,
} from "vscode-languageclient";
import { IFeature } from "../feature";
import { ILogger } from "../logging";
import * as Settings from "../settings";

/**
 * Defines a grammar file that is in a VS Code Extension
 */
interface IExtensionGrammar {
    /**
     * The name of the language, e.g. powershell
     */
    language?: string;
    /**
     * The absolute path to the grammar file
     */
    path?: string;
    /**
     * The path to the extension
     */
    extensionPath?: string;
}

/**
 * Defines a VS Code extension with minimal properities for grammar contribution
 */
interface IExtensionPackage {
    /**
     * Hashtable of items this extension contributes
     */
    contributes?: {
        /**
         * Array of grammars this extension supports
         */
        grammars?: IExtensionGrammar[],
    };
}

/**
 * Defines a grammar token in a text document
 * Need to reproduce the IToken interface from vscode-textmate due to the odd way it has to be required
 * https://github.com/Microsoft/vscode-textmate/blob/46af9487e1c8fa78aa1f2e2/release/main.d.ts#L161-L165
 */
interface IToken {
    /**
     * Zero based offset where the token starts
     */
    startIndex: number;
    /**
     * Zero based offset where the token ends
     */
    readonly endIndex: number;
    /**
     * Array of scope names that the token is a member of
     */
    readonly scopes: string[];
}

/**
 * Defines a list of grammar tokens, typically for an entire text document
 */
interface ITokenList extends Array<IToken> { }

/**
 * Due to how the vscode-textmate library is required, we need to minimally define a Grammar object, which
 * can be used to tokenize a text document.
 * https://github.com/Microsoft/vscode-textmate/blob/46af9487e1c8fa78aa1f2e2/release/main.d.ts#L92-L108
 */
interface IGrammar {
    /**
     * Tokenize `lineText` using previous line state `prevState`.
     */
    tokenizeLine(lineText: any, prevState: any): any;
}

/**
 * Defines a pair line numbers which describes a potential folding range in a text document
 */
class LineNumberRange {
    /**
     * The zero-based line number of the start of the range
     */
    public startline: number;
    /**
     * The zero-based line number of the end of the range
     */
    public endline: number;
    /**
     * The type of range this represents
     */
    public rangeKind: vscode.FoldingRangeKind;

    constructor(
        rangeKind: vscode.FoldingRangeKind,
    ) {
        this.rangeKind = rangeKind;
    }

    /**
     * Build the range based on a pair of grammar tokens
     * @param start     The token where the range starts
     * @param end       The token where the range ends
     * @param document  The text document
     * @returns         Built LineNumberRange object
     */
    public fromTokenPair(
        start: IToken,
        end: IToken,
        document: vscode.TextDocument,
    ): LineNumberRange {
        this.startline = document.positionAt(start.startIndex).line;
        this.endline = document.positionAt(end.startIndex).line;
        return this;
    }

    /**
     * Build the range based on a pair of line numbers
     * @param startLine The line where the range starts
     * @param endLine   The line where the range ends
     * @returns         Built LineNumberRange object
     */
    public fromLinePair(
        startLine: number,
        endLine: number,
    ): LineNumberRange {
        this.startline = startLine;
        this.endline = endLine;
        return this;
    }

    /**
     * Whether this line number range, is a valid folding range in the document
     * @returns Whether the range passes all validation checks
     */
    public isValidRange(): boolean {
        // Start and end lines must be defined and positive integers
        if (this.startline == null || this.endline == null) { return false; }
        if (this.startline < 0 || this.endline < 0) { return false; }
        // End line number cannot be before the start
        if (this.startline > this.endline) { return false; }
        // Folding ranges must span at least 2 lines
        return (this.endline - this.startline >= 1);
    }

    /**
     * Creates a vscode.FoldingRange object based on this object
     * @returns A Folding Range object for use with the Folding Provider
     */
    public toFoldingRange(): vscode.FoldingRange {
        return new vscode.FoldingRange(this.startline, this.endline, this.rangeKind);
    }
}

/**
 * An array of line number ranges
 */
interface ILineNumberRangeList extends Array<LineNumberRange> { }

/**
 * A PowerShell syntax aware Folding Provider
 */
export class FoldingProvider implements vscode.FoldingRangeProvider {
    private powershellGrammar: IGrammar;

    constructor(
        powershellGrammar: IGrammar,
    ) {
        this.powershellGrammar = powershellGrammar;
    }

    /**
     * Given a text document, parse the document and return a list of code folding ranges.
     * @param document  Text document to parse
     * @param context   Not used
     * @param token     Not used
     */
    public async provideFoldingRanges(
        document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken,
    ): Promise<vscode.FoldingRange[]> {

        // If the grammar hasn't been setup correctly, return empty result
        if (this.powershellGrammar == null) { return []; }

        // Convert the document text into a series of grammar tokens
        const tokens: ITokenList = this.powershellGrammar.tokenizeLine(document.getText(), null).tokens;

        // Parse the token list looking for matching tokens and return
        // a list of LineNumberRange objects.  Then filter the list and only return matches
        // that are a valid folding range e.g. It meets a minimum line span limit
        const foldableRegions = this.extractFoldableRegions(tokens, document)
            .filter((item) => item.isValidRange());

        // Sort the list of matched tokens, starting at the top of the document,
        // and ensure that, in the case of multiple ranges starting the same line,
        // that the largest range (i.e. most number of lines spanned) is sorted
        // first.  This is needed as vscode will just ignore any duplicate folding
        // ranges.
        foldableRegions.sort((a: LineNumberRange, b: LineNumberRange) => {
            // Initially look at the start line
            if (a.startline > b.startline) { return 1; }
            if (a.startline < b.startline) { return -1; }
            // They have the same start line so now consider the end line.
            // The biggest line range is sorted first
            if (a.endline > b.endline) { return -1; }
            if (a.endline < b.endline) { return 1; }
            // They're the same
            return 0;
        });

        // Convert the matched token list into a FoldingRange[]
        const foldingRanges = [];
        foldableRegions.forEach((item) => { foldingRanges.push(item.toFoldingRange()); });

        return foldingRanges;
    }

    /**
     * Given a start and end textmate scope name, find matching grammar tokens
     * and pair them together.  Uses a simple stack to take into account nested regions.
     * @param tokens         List of grammar tokens to parse
     * @param startScopeName The name of the starting scope to match
     * @param endScopeName   The name of the ending scope to match
     * @param matchType      The type of range this matched token pair represents e.g. A comment
     * @param document       The source text document
     * @returns              A list of LineNumberRange objects of the matched token scopes
     */
    private matchScopeElements(
        tokens: ITokenList,
        startScopeName: string,
        endScopeName: string,
        matchType: vscode.FoldingRangeKind,
        document: vscode.TextDocument,
    ): ILineNumberRangeList {
        const result = [];
        const tokenStack = [];

        tokens.forEach((token) => {
            if (token.scopes.indexOf(startScopeName) !== -1) {
                tokenStack.push(token);
            }
            if (token.scopes.indexOf(endScopeName) !== -1) {
                result.unshift((new LineNumberRange(matchType)).fromTokenPair(tokenStack.pop(), token, document));
            }
        });

        return result;
    }

    /**
     * Given a textmate scope name, find a series of contiguous tokens which contain
     * that scope name and pair them together.
     * @param tokens    List of grammar tokens to parse
     * @param scopeName The name of the scope to match
     * @param matchType The type of range this region represents e.g. A comment
     * @param document  The source text document
     * @returns         A list of LineNumberRange objects of the contiguous token scopes
     */
    private matchContiguousScopeElements(
        tokens: ITokenList,
        scopeName: string,
        matchType: vscode.FoldingRangeKind,
        document: vscode.TextDocument,
    ): ILineNumberRangeList {
        const result = [];
        let startToken;

        tokens.forEach((token, index) => {
            if (token.scopes.indexOf(scopeName) !== -1) {
                if (startToken === undefined) { startToken = token; }

                // If we're at the end of the token list, or the next token does not include the scopeName
                // we've reached the end of the contiguous block.
                if (((index + 1) >= tokens.length) || (tokens[index + 1].scopes.indexOf(scopeName) === -1)) {
                    result.push((new LineNumberRange(matchType)).fromTokenPair(startToken, token, document));
                    startToken = undefined;
                }
            }
        });

        return result;
    }

    /**
     * Given a zero based offset, find the line text preceeding it in the document
     * @param offset   Zero based offset in the document
     * @param document The source text document
     * @returns        The line text preceeding the offset, not including the preceeding Line Feed
     */
    private preceedingText(
        offset: number,
        document: vscode.TextDocument,
    ): string {
        const endPos = document.positionAt(offset);
        const startPos = endPos.translate(0, -endPos.character);

        return document.getText(new vscode.Range(startPos, endPos));
    }

    /**
     * Given a zero based offset, find the line text after it in the document
     * @param offset   Zero based offset in the document
     * @param document The source text document
     * @returns        The line text after the offset, not including the subsequent Line Feed
     */
    private subsequentText(
        offset: number,
        document: vscode.TextDocument,
    ): string {
        const startPos: vscode.Position = document.positionAt(offset);
        const endPos: vscode.Position = document.lineAt(document.positionAt(offset)).range.end;
        return document.getText(new vscode.Range(startPos, endPos));
    }

    /**
     * Finding blocks of comment tokens is more complicated as the newline characters are not
     * classed as comments.  To workaround this we search for the comment character `#` scope name
     * "punctuation.definition.comment.powershell" and then determine contiguous line numbers from there
     * @param tokens   List of grammar tokens to parse
     * @param document The source text document
     * @returns        A list of LineNumberRange objects for blocks of comment lines
     */
    private matchBlockCommentScopeElements(
        tokens: ITokenList,
        document: vscode.TextDocument,
    ): ILineNumberRangeList {
        const result = [];

        const emptyLine = /^[\s]+$/;

        let startLine: number = -1;
        let nextLine: number = -1;

        tokens.forEach((token) => {
            if (token.scopes.indexOf("punctuation.definition.comment.powershell") !== -1) {
                // The punctuation.definition.comment.powershell token matches new-line comments
                // and inline comments e.g. `$x = 'foo' # inline comment`.  We are only interested
                // in comments which begin the line i.e. no preceeding text
                if (emptyLine.test(this.preceedingText(token.startIndex, document))) {
                    const lineNum = document.positionAt(token.startIndex).line;
                    // A simple pattern for keeping track of contiguous numbers in a known sorted array
                    if (startLine === -1) {
                        startLine = lineNum;
                    } else if (lineNum !== nextLine) {
                        result.push(
                            (
                                new LineNumberRange(vscode.FoldingRangeKind.Comment)
                            ).fromLinePair(startLine, nextLine - 1),
                        );
                        startLine = lineNum;
                    }
                    nextLine = lineNum + 1;
                }
            }
        });

        // If we exit the token array and we're still processing comment lines, then the
        // comment block simply ends at the end of document
        if (startLine !== -1) {
            result.push((new LineNumberRange(vscode.FoldingRangeKind.Comment)).fromLinePair(startLine, nextLine - 1));
        }

        return result;
    }

    /**
     * Create a new token object with an appended scopeName
     * @param token     The token to append the scope to
     * @param scopeName The scope name to append
     * @returns         A copy of the original token, but with the scope appended
     */
    private addTokenScope(
        token: IToken,
        scopeName: string,
    ): IToken {
        // Only a shallow clone is required
        const tokenClone = Object.assign({}, token);
        tokenClone.scopes.push(scopeName);
        return tokenClone;
    }

    /**
     * Given a list of grammar tokens, find the tokens that are comments and
     * the comment text is either `# region` or `# endregion`.  Return a new list of tokens
     * with custom scope names added, "custom.start.region" and "custom.end.region" respectively
     * @param tokens   List of grammar tokens to parse
     * @param document The source text document
     * @returns        A list of LineNumberRange objects of the line comment region blocks
     */
    private extractRegionScopeElements(
        tokens: ITokenList,
        document: vscode.TextDocument,
    ): ITokenList {
        const result = [];

        const emptyLine = /^[\s]+$/;
        const startRegionText = /^#\s*region\b/;
        const endRegionText = /^#\s*endregion\b/;

        tokens.forEach((token) => {
            if (token.scopes.indexOf("punctuation.definition.comment.powershell") !== -1) {
                if (emptyLine.test(this.preceedingText(token.startIndex, document))) {
                    const commentText = this.subsequentText(token.startIndex, document);
                    if (startRegionText.test(commentText)) {
                        result.push(this.addTokenScope(token, "custom.start.region"));
                    }
                    if (endRegionText.test(commentText)) {
                        result.push(this.addTokenScope(token, "custom.end.region"));
                    }
                }
            }
        });
        return result;
    }

    /**
     * Given a list of tokens, return a list of line number ranges which could be folding regions in the document
     * @param tokens   List of grammar tokens to parse
     * @param document The source text document
     * @returns        A list of LineNumberRange objects of the possible document folding regions
     */
    private extractFoldableRegions(
        tokens: ITokenList,
        document: vscode.TextDocument,
    ): ILineNumberRangeList {
        const matchedTokens: ILineNumberRangeList = [];

        // Find matching braces   { -> }
        this.matchScopeElements(
            tokens,
            "punctuation.section.braces.begin.powershell",
            "punctuation.section.braces.end.powershell",
            vscode.FoldingRangeKind.Region, document)
            .forEach((match) => { matchedTokens.push(match); });

        // Find matching parentheses   ( -> )
        this.matchScopeElements(
            tokens,
            "punctuation.section.group.begin.powershell",
            "punctuation.section.group.end.powershell",
            vscode.FoldingRangeKind.Region, document)
            .forEach((match) => { matchedTokens.push(match); });

        // Find contiguous here strings   @' -> '@
        this.matchContiguousScopeElements(
            tokens,
            "string.quoted.single.heredoc.powershell",
            vscode.FoldingRangeKind.Region, document)
            .forEach((match) => { matchedTokens.push(match); });

        // Find contiguous here strings   @" -> "@
        this.matchContiguousScopeElements(
            tokens,
            "string.quoted.double.heredoc.powershell",
            vscode.FoldingRangeKind.Region, document)
            .forEach((match) => { matchedTokens.push(match); });

        // Find matching comment regions   #region -> #endregion
        this.matchScopeElements(
            this.extractRegionScopeElements(tokens, document),
            "custom.start.region",
            "custom.end.region",
            vscode.FoldingRangeKind.Region, document)
            .forEach((match) => { matchedTokens.push(match); });

        // Find blocks of line comments   # comment1\n# comment2\n...
        this.matchBlockCommentScopeElements(tokens, document).forEach((match) => { matchedTokens.push(match); });

        // Find matching block comments   <# -> #>
        this.matchScopeElements(
            tokens,
            "punctuation.definition.comment.block.begin.powershell",
            "punctuation.definition.comment.block.end.powershell",
            vscode.FoldingRangeKind.Comment, document)
            .forEach((match) => { matchedTokens.push(match); });

        return matchedTokens;
    }
}

export class FoldingFeature implements IFeature {
    private foldingProvider: FoldingProvider;

    /**
     * Constructs a handler for the FoldingProvider.  It returns success if the required grammar file can not be located
     * but does not regist a provider.  This causes VS Code to instead still use the indentation based provider
     * @param logger           The logging object to send messages to
     * @param documentSelector documentSelector object for this Folding Provider
     */
    constructor(private logger: ILogger, documentSelector: DocumentSelector) {
        const settings = Settings.load();
        if (!(settings.codeFolding && settings.codeFolding.enable)) { return; }

        this.loadGrammar(logger)
            .then((grammar) => {
                // If the PowerShell grammar is not available for some reason, don't register a folding provider,
                // which reverts VSCode to the default indentation style folding
                if (!grammar) {
                    logger.writeWarning("Unable to load the PowerShell grammar file");
                    return;
                }

                this.foldingProvider = new FoldingProvider(grammar);
                vscode.languages.registerFoldingRangeProvider(documentSelector, this.foldingProvider);

                logger.write("Syntax Folding Provider registered");
            }, (err) => {
                this.logger.writeError(`Failed to load grammar file - error: ${err}`);
            });
    }

    /* dispose() is required by the IFeature interface, but is not required by this feature */
    public dispose(): any { return undefined; }

    /* setLanguageClient() is required by the IFeature interface, but is not required by this feature */
    public setLanguageClient(languageclient: LanguageClient): void { return undefined; }

    /**
     * Returns the PowerShell grammar parser, from the vscode-textmate node module
     * @param logger The logging object to send messages to
     * @returns      A grammar parser for the PowerShell language is succesful or undefined if an error occured
     */
    public loadGrammar(logger: ILogger): Thenable<IGrammar> {
        const tm = this.getCoreNodeModule("vscode-textmate", logger);
        if (tm == null) { return undefined; }
        logger.writeDiagnostic(`Loaded the vscode-textmate module`);

        const grammarPath = this.powerShellGrammarPath();
        if (grammarPath == null) { return undefined; }
        logger.writeDiagnostic(`PowerShell grammar file specified as ${grammarPath}`);

        const grammarPaths = {
            powershell: grammarPath,
        };

        const registry = new tm.Registry({
            loadGrammar(scopeName) {
                const gpath = grammarPaths[scopeName];
                if (gpath) {
                    return new Promise((c, e) => {
                        fs.readFile(gpath, (error, content) => {
                            if (error) {
                                e(error);
                            } else {
                                const rawGrammar = tm.parseRawGrammar(content.toString(), gpath);
                                c(rawGrammar);
                            }
                        });
                    });
                }
                return null;
            },
        });

        if (registry == null) { return undefined; }
        logger.writeDiagnostic(`Created the textmate Registry`);

        const grammar = registry.loadGrammar("powershell");
        return grammar;
    }

    /**
     * Returns a node module installed within VSCode, or null if it fails.
     * Some node modules (e.g. vscode-textmate) cannot be required directly, instead the known module locations
     * must be tried. Documented in https://github.com/Microsoft/vscode/issues/46281
     * @param moduleName Name of the module to load e.g. vscode-textmate
     * @param logger     The logging object to send messages to
     * @returns          The required module, or null if the module cannot be required
     */
    private getCoreNodeModule(moduleName: string, logger: ILogger) {
        // Attempt to load the module from known locations
        const loadLocations: string[] = [
            `${vscode.env.appRoot}/node_modules.asar/${moduleName}`,
            `${vscode.env.appRoot}/node_modules/${moduleName}`,
        ];

        for (const filename of loadLocations) {
            try {
                const mod = require(filename);
                logger.writeDiagnostic(`Succesfully required ${filename}`);
                return mod;
            } catch (err) {
                logger.writeError(`Error while attempting to require ${filename}`, err);
            }
        }
        return null;
    }

     /**
      * Search all of the loaded extenions for the PowerShell grammar file
      * @returns The absolute path to the PowerShell grammar file.  Returns undefined if the path cannot be located.
      */
     private powerShellGrammarPath(): string {
        // Go through all the extension packages and search for PowerShell grammars,
        // returning the path to the first we find
        for (const ext of vscode.extensions.all) {
            if (!(ext.packageJSON && ext.packageJSON.contributes && ext.packageJSON.contributes.grammars)) {
                continue;
            }
            for (const grammar of ext.packageJSON.contributes.grammars) {
                if (grammar.language !== "powershell") { continue; }
                return path.join(ext.extensionPath, grammar.path);
            }
        }
        return undefined;
    }
}

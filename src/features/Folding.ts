import * as path from "path";
import * as vscode from "vscode";
import {
    DocumentSelector,
    LanguageClient,
} from "vscode-languageclient";
import { IFeature } from "../feature";
import { Logger } from "../logging";

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
    constructor(private logger: Logger, documentSelector: DocumentSelector) {
        const grammar: IGrammar = this.grammar(logger);

        // If the PowerShell grammar is not available for some reason, don't register a folding provider,
        // which reverts VSCode to the default indentation style folding
        if (grammar == null) {
            logger.writeWarning("Unable to load the PowerShell grammar file");
            return;
        }

        this.foldingProvider = new FoldingProvider(grammar);
        vscode.languages.registerFoldingRangeProvider(documentSelector, this.foldingProvider);

        logger.write("Syntax Folding Provider registered");
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
    public grammar(logger: Logger): IGrammar {
        const tm = this.getCoreNodeModule("vscode-textmate", logger);
        if (tm == null) { return undefined; }
        logger.writeDiagnostic(`Loaded the vscode-textmate module`);
        const registry = new tm.Registry();
        if (registry == null) { return undefined; }
        logger.writeDiagnostic(`Created the textmate Registry`);
        const grammarPath = this.powerShellGrammarPath();
        if (grammarPath == null) { return undefined; }
        logger.writeDiagnostic(`PowerShell grammar file specified as ${grammarPath}`);
        try {
            return registry.loadGrammarFromPathSync(grammarPath);
        } catch (err) {
            logger.writeError(`Error while loading the PowerShell grammar file at ${grammarPath}`, err);
        }
    }

    /**
     * Returns a node module installed within VSCode, or null if it fails.
     * Some node modules (e.g. vscode-textmate) cannot be required directly, instead the known module locations
     * must be tried. Documented in https://github.com/Microsoft/vscode/issues/46281
     * @param moduleName Name of the module to load e.g. vscode-textmate
     * @param logger     The logging object to send messages to
     * @returns          The required module, or null if the module cannot be required
     */
    private getCoreNodeModule(moduleName: string, logger: Logger) {
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

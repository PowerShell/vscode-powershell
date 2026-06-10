// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import vscode = require("vscode");

// This folding provider is a client-side fallback that works without the
// PowerShell Editor Services language server, which cannot run in virtual
// workspaces (e.g. GitHub or Azure DevOps repositories opened with the Remote
// Repositories extension). It is a faithful port of the server's
// `TokenOperations.FoldableReferences` logic so that folding behaves the same
// whether or not the language server is available.
// See https://github.com/PowerShell/vscode-powershell/issues/4051

/** Describes the kind of a foldable region, mirroring the LSP folding kinds. */
export enum FoldingReferenceKind {
    Comment = "comment",
    Region = "region",
}

/** A foldable region of text in a document, using zero-based positions. */
export interface IFoldingReference {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
    kind?: FoldingReferenceKind;
}

// These regular expressions match lines which mark the start and end of a
// `#region` comment in a PowerShell script. They are intentionally identical to
// the ones used by PowerShell Editor Services, which are in turn based on the
// defaults in the VS Code PowerShell language configuration.
const startRegionTextRegex = /^\s*#[rR]egion\b/;
const endRegionTextRegex = /^\s*#[eE]nd[rR]egion\b/;

enum TokenKind {
    LCurly,
    RCurly,
    LParen,
    RParen,
    Span,
    Comment,
}

interface IToken {
    kind: TokenKind;
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
    // The following are only relevant to comment tokens.
    text?: string;
    firstOnLine?: boolean;
    isLineComment?: boolean;
}

/**
 * Tokenizes the given text into the minimal set of tokens needed to compute
 * foldable regions: brackets, parentheses, here-strings, braced variables and
 * comments. Strings and comments are treated as opaque so that brackets inside
 * them are not mistakenly matched.
 */
function tokenize(text: string): IToken[] {
    const tokens: IToken[] = [];
    const length = text.length;
    let i = 0;
    let line = 0;
    let column = 0;
    let lineHasContent = false;

    // Consumes the current character, advancing the line/column counters.
    const consume = (): void => {
        if (text[i] === "\n") {
            line++;
            column = 0;
            lineHasContent = false;
        } else {
            column++;
        }
        i++;
    };

    while (i < length) {
        const char = text[i];

        if (char === "\n") {
            consume();
            continue;
        }
        if (char === " " || char === "\t") {
            consume();
            continue;
        }

        const firstOnLine = !lineHasContent;
        lineHasContent = true;

        // A backtick escapes the next character (including a trailing newline
        // for line continuations), so skip both.
        if (char === "`") {
            consume();
            if (i < length) {
                consume();
            }
            continue;
        }

        // Single-quoted string. A doubled quote (`''`) is an escaped quote.
        if (char === "'") {
            consume();
            while (i < length) {
                if (text[i] === "'") {
                    if (text[i + 1] === "'") {
                        consume();
                        consume();
                        continue;
                    }
                    consume();
                    break;
                }
                consume();
            }
            continue;
        }

        // Double-quoted string. A backtick escapes the next character and a
        // doubled quote (`""`) is an escaped quote. Subexpressions inside the
        // string are treated as opaque text.
        if (char === '"') {
            consume();
            while (i < length) {
                if (text[i] === "`") {
                    consume();
                    if (i < length) {
                        consume();
                    }
                    continue;
                }
                if (text[i] === '"') {
                    if (text[i + 1] === '"') {
                        consume();
                        consume();
                        continue;
                    }
                    consume();
                    break;
                }
                consume();
            }
            continue;
        }

        // Block comment `<# ... #>`, which may span multiple lines.
        if (char === "<" && text[i + 1] === "#") {
            const startLine = line;
            const startCharacter = column;
            consume();
            consume();
            while (i < length) {
                if (text[i] === "#" && text[i + 1] === ">") {
                    consume();
                    consume();
                    break;
                }
                consume();
            }
            tokens.push({
                kind: TokenKind.Comment,
                startLine,
                startCharacter,
                endLine: line,
                endCharacter: column,
                isLineComment: false,
                firstOnLine,
            });
            continue;
        }

        // Line comment `# ...`, which runs to the end of the line.
        if (char === "#") {
            const startLine = line;
            const startCharacter = column;
            const textStart = i;
            while (i < length && text[i] !== "\n") {
                consume();
            }
            tokens.push({
                kind: TokenKind.Comment,
                startLine,
                startCharacter,
                endLine: line,
                endCharacter: column,
                text: text.substring(textStart, i),
                isLineComment: true,
                firstOnLine,
            });
            continue;
        }

        // `@` may introduce a here-string (`@'`/`@"`), an array literal (`@(`)
        // or a hash literal (`@{`).
        if (char === "@") {
            const next = text[i + 1];
            if (next === "'" || next === '"') {
                // It's only a here-string if nothing but whitespace follows the
                // opening quote on the same line.
                let j = i + 2;
                let onlyWhitespace = true;
                while (j < length && text[j] !== "\n") {
                    if (text[j] !== " " && text[j] !== "\t") {
                        onlyWhitespace = false;
                        break;
                    }
                    j++;
                }
                if (onlyWhitespace) {
                    const quote = next;
                    const startLine = line;
                    const startCharacter = column;
                    consume();
                    consume();
                    // The terminator is `'@`/`"@` at the very start of a line.
                    while (i < length) {
                        if (
                            column === 0 &&
                            text[i] === quote &&
                            text[i + 1] === "@"
                        ) {
                            consume();
                            consume();
                            break;
                        }
                        consume();
                    }
                    tokens.push({
                        kind: TokenKind.Span,
                        startLine,
                        startCharacter,
                        endLine: line,
                        endCharacter: column,
                    });
                    continue;
                }
            } else if (next === "(") {
                tokens.push({
                    kind: TokenKind.LParen,
                    startLine: line,
                    startCharacter: column,
                    endLine: line,
                    endCharacter: column + 2,
                });
                consume();
                consume();
                continue;
            } else if (next === "{") {
                tokens.push({
                    kind: TokenKind.LCurly,
                    startLine: line,
                    startCharacter: column,
                    endLine: line,
                    endCharacter: column + 2,
                });
                consume();
                consume();
                continue;
            }
            // Otherwise it's splatting (`@var`) or stray text; treat as normal.
            consume();
            continue;
        }

        // `$(` is a subexpression and `${ ... }` is a braced variable name that
        // may span multiple lines.
        if (char === "$") {
            const next = text[i + 1];
            if (next === "(") {
                tokens.push({
                    kind: TokenKind.LParen,
                    startLine: line,
                    startCharacter: column,
                    endLine: line,
                    endCharacter: column + 2,
                });
                consume();
                consume();
                continue;
            }
            if (next === "{") {
                const startLine = line;
                const startCharacter = column;
                consume();
                consume();
                while (i < length) {
                    if (text[i] === "`") {
                        consume();
                        if (i < length) {
                            consume();
                        }
                        continue;
                    }
                    if (text[i] === "}") {
                        consume();
                        break;
                    }
                    consume();
                }
                tokens.push({
                    kind: TokenKind.Span,
                    startLine,
                    startCharacter,
                    endLine: line,
                    endCharacter: column,
                });
                continue;
            }
            consume();
            continue;
        }

        if (char === "{") {
            tokens.push({
                kind: TokenKind.LCurly,
                startLine: line,
                startCharacter: column,
                endLine: line,
                endCharacter: column + 1,
            });
            consume();
            continue;
        }
        if (char === "}") {
            tokens.push({
                kind: TokenKind.RCurly,
                startLine: line,
                startCharacter: column,
                endLine: line,
                endCharacter: column + 1,
            });
            consume();
            continue;
        }
        if (char === "(") {
            tokens.push({
                kind: TokenKind.LParen,
                startLine: line,
                startCharacter: column,
                endLine: line,
                endCharacter: column + 1,
            });
            consume();
            continue;
        }
        if (char === ")") {
            tokens.push({
                kind: TokenKind.RParen,
                startLine: line,
                startCharacter: column,
                endLine: line,
                endCharacter: column + 1,
            });
            consume();
            continue;
        }

        consume();
    }

    return tokens;
}

/**
 * Compares two folding references, ordering by the largest range first. This
 * mirrors the comparison used by PowerShell Editor Services so that, when
 * multiple references share a start line, the largest is kept.
 */
function compareReferences(a: IFoldingReference, b: IFoldingReference): number {
    if (a.startLine < b.startLine) {
        return -1;
    }
    if (a.startLine > b.startLine) {
        return 1;
    }
    if (a.endLine > b.endLine) {
        return -1;
    }
    if (a.endLine < b.endLine) {
        return 1;
    }
    if (a.startCharacter < b.startCharacter) {
        return -1;
    }
    if (a.startCharacter > b.startCharacter) {
        return 1;
    }
    if (a.endCharacter < b.endCharacter) {
        return -1;
    }
    if (a.endCharacter > b.endCharacter) {
        return 1;
    }
    if (a.kind === b.kind) {
        return 0;
    }
    if (a.kind === undefined && b.kind !== undefined) {
        return 1;
    }
    return -1;
}

/**
 * Holds folding references and enforces the rule that there is only one fold per
 * start line, keeping the largest range when there are duplicates.
 */
class FoldingReferenceList {
    private readonly references = new Map<number, IFoldingReference>();

    public safeAdd(item: IFoldingReference | undefined): void {
        if (item === undefined) {
            return;
        }

        const current = this.references.get(item.startLine);
        if (current === undefined || compareReferences(current, item) === 1) {
            this.references.set(item.startLine, item);
        }
    }

    public toArray(): IFoldingReference[] {
        return [...this.references.values()].sort(compareReferences);
    }
}

/**
 * Creates a folding reference from a start and end token, returning undefined if
 * the range spans only a single line.
 */
function createReference(
    startToken: IToken,
    endToken: IToken,
    kind?: FoldingReferenceKind,
): IFoldingReference | undefined {
    if (endToken.endLine === startToken.startLine) {
        return undefined;
    }
    return {
        startLine: startToken.startLine,
        startCharacter: startToken.startCharacter,
        endLine: endToken.endLine,
        endCharacter: endToken.endCharacter,
        kind,
    };
}

/**
 * Creates a folding reference from a start token and an explicit end line,
 * returning undefined if the range spans only a single line.
 */
function createReferenceToLine(
    startToken: IToken,
    endLine: number,
    kind?: FoldingReferenceKind,
): IFoldingReference | undefined {
    if (endLine === startToken.startLine) {
        return undefined;
    }
    return {
        startLine: startToken.startLine,
        startCharacter: startToken.startCharacter,
        endLine,
        endCharacter: 0,
        kind,
    };
}

/**
 * Extracts all of the unique foldable regions in a PowerShell script. This is a
 * faithful port of `TokenOperations.FoldableReferences` from PowerShell Editor
 * Services so that client-side folding matches the server's behavior.
 */
export function getFoldingReferences(text: string): IFoldingReference[] {
    // Normalize line endings so that columns are computed consistently, exactly
    // as the server's tokenizer does regardless of CRLF or LF.
    const tokens = tokenize(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
    const referenceList = new FoldingReferenceList();

    // Find matching braces and parentheses, including their `@`/`$` prefixed
    // variants, by pairing them up with a stack.
    const curlyStack: IToken[] = [];
    const parenStack: IToken[] = [];
    for (const token of tokens) {
        switch (token.kind) {
            case TokenKind.LCurly:
                curlyStack.push(token);
                break;
            case TokenKind.RCurly: {
                const start = curlyStack.pop();
                if (start !== undefined) {
                    referenceList.safeAdd(createReference(start, token));
                }
                break;
            }
            case TokenKind.LParen:
                parenStack.push(token);
                break;
            case TokenKind.RParen: {
                const start = parenStack.pop();
                if (start !== undefined) {
                    referenceList.safeAdd(createReference(start, token));
                }
                break;
            }
            case TokenKind.Span:
                // Here-strings and braced variables fold onto themselves.
                if (token.startLine !== token.endLine) {
                    referenceList.safeAdd(createReference(token, token));
                }
                break;
            case TokenKind.Comment:
                break;
        }
    }

    // Find comment regions (`#region`/`#endregion`), multi-line block comments
    // (`<# ... #>`) and contiguous blocks of line comments.
    const regionStack: IToken[] = [];
    let blockStartToken: IToken | undefined;
    let blockNextLine = -1;

    for (const token of tokens) {
        if (token.kind !== TokenKind.Comment) {
            continue;
        }

        // A multi-line comment is a foldable block comment.
        if (token.startLine !== token.endLine) {
            referenceList.safeAdd(
                createReference(token, token, FoldingReferenceKind.Comment),
            );
            continue;
        }

        // Only line comments that begin a line are considered for regions and
        // contiguous comment blocks.
        if (token.isLineComment !== true || token.firstOnLine !== true) {
            continue;
        }

        const commentText = token.text ?? "";
        if (startRegionTextRegex.test(commentText)) {
            regionStack.push(token);
            continue;
        }
        if (endRegionTextRegex.test(commentText)) {
            // Mismatched regions in the script can cause bad stacks.
            const start = regionStack.pop();
            if (start !== undefined) {
                referenceList.safeAdd(
                    createReference(start, token, FoldingReferenceKind.Region),
                );
            }
            continue;
        }

        // Otherwise this is a plain line comment that may be part of a block.
        const thisLine = token.startLine;
        if (blockStartToken !== undefined && thisLine !== blockNextLine) {
            referenceList.safeAdd(
                createReferenceToLine(
                    blockStartToken,
                    blockNextLine - 1,
                    FoldingReferenceKind.Comment,
                ),
            );
            blockStartToken = token;
        }
        blockStartToken ??= token;
        blockNextLine = thisLine + 1;
    }

    // If we reach the end of the document while still in a comment block, the
    // block ends at the last comment line.
    if (blockStartToken !== undefined) {
        referenceList.safeAdd(
            createReferenceToLine(
                blockStartToken,
                blockNextLine - 1,
                FoldingReferenceKind.Comment,
            ),
        );
    }

    return referenceList.toArray();
}

/** Returns true if the current workspace is entirely virtual (no local files). */
export function isVirtualWorkspace(): boolean {
    const folders = vscode.workspace.workspaceFolders;
    return (
        folders !== undefined &&
        folders.length > 0 &&
        folders.every((folder) => folder.uri.scheme !== "file")
    );
}

/**
 * A PowerShell folding range provider that runs entirely on the client. It is
 * used as a fallback in virtual workspaces where the language server, which
 * normally provides folding, cannot run.
 */
export class PowerShellFoldingProvider implements vscode.FoldingRangeProvider {
    public provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        _token: vscode.CancellationToken,
    ): vscode.FoldingRange[] {
        const configuration = vscode.workspace.getConfiguration(
            "powershell.codeFolding",
        );

        // When syntax-based folding is disabled, return nothing so that VS Code
        // falls back to its default indentation-based folding.
        if (!configuration.get<boolean>("enable", true)) {
            return [];
        }

        // When showing the last line, the end line of each region is decremented
        // by one so that the closing line remains visible, matching the server.
        const endLineOffset = configuration.get<boolean>("showLastLine", true)
            ? -1
            : 0;

        const ranges: vscode.FoldingRange[] = [];
        for (const reference of getFoldingReferences(document.getText())) {
            ranges.push(
                new vscode.FoldingRange(
                    reference.startLine,
                    reference.endLine + endLineOffset,
                    toFoldingRangeKind(reference.kind),
                ),
            );
        }

        return ranges;
    }
}

function toFoldingRangeKind(
    kind: FoldingReferenceKind | undefined,
): vscode.FoldingRangeKind | undefined {
    switch (kind) {
        case FoldingReferenceKind.Comment:
            return vscode.FoldingRangeKind.Comment;
        case FoldingReferenceKind.Region:
            return vscode.FoldingRangeKind.Region;
        default:
            return undefined;
    }
}

/**
 * Registers the client-side PowerShell folding provider. The provider is only
 * registered in virtual workspaces, where the language server cannot run; in
 * normal workspaces the server provides folding.
 */
export class FoldingFeature implements vscode.Disposable {
    private registration: vscode.Disposable | undefined;

    constructor() {
        if (isVirtualWorkspace()) {
            // Match PowerShell documents regardless of scheme, since virtual
            // workspaces use schemes other than `file`.
            this.registration = vscode.languages.registerFoldingRangeProvider(
                { language: "powershell" },
                new PowerShellFoldingProvider(),
            );
        }
    }

    public dispose(): void {
        this.registration?.dispose();
    }
}

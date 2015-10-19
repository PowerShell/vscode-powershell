/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');

class CommentsSupport implements vscode.Modes.ICommentsSupport {
	
	commentsConfiguration: vscode.Modes.ICommentsConfiguration = {
		lineCommentTokens: ['#'],
		blockCommentStartToken: '<#',
		blockCommentEndToken: '#>' 
	};
	
}

export = CommentsSupport;
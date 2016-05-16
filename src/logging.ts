import fs = require('fs');

export function ensurePathExists(targetPath: string) {
    // Ensure that the path exists
    try {
        fs.mkdirSync(targetPath);
    }
    catch (e) {
        // If the exception isn't to indicate that the folder
        // exists already, rethrow it.
        if (e.code != 'EEXIST') {
            throw e;
        }
    }
}

export function getLogName(baseName: string): string {
    return Math.floor(Date.now() / 1000) + '-' +  baseName + '.log';
}
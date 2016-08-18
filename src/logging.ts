import fs = require('fs');

export function getLogName(baseName: string): string {
    return Math.floor(Date.now() / 1000) + '-' +  baseName + '.log';
}
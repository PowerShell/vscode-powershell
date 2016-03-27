# Working with the PowerShell extension code

## Building the code

1. Install [Node.js](https://nodejs.org/en/) 4.4.1 or higher.

2. Install the package dependencies by running one of the following commands:

   ```
   # From a PowerShell prompt
   npm install

   # Or from Visual Studio Code
   Press Ctrl+P and type "task install"
   ```

3. Compile the code by running one of the following commands:

   ```
   # From a PowerShell prompt
   npm run compile

   # Or from Visual Studio Code
   Press Ctrl+P and type "task compile"
   ```
   This will compile the TypeScript files in the project to JavaScript files.

   OR

   You can compile the files and then have the TypeScript compiler watch for changes to
   the source files and automatically recompile those files when changes are saved.
   To do this, run one of the following commands:

   ```
   # From a PowerShell prompt
   npm run compile-watch

   # Or from Visual Studio Code
   Press Ctrl+P and type "task compile-watch"
   ```

## Running the compiled code

1. From a PowerShell prompt, run the following command:

   ```
   code --extensionDevelopmentPath="c:\path\to\vscode-powershell" .
   ```

2. If you allow the compiler to continue watching for file changes, you can use
   the `Reload Window` command found in the command palette `(Ctrl+Shift+P)`
   so that the new source files are loaded.

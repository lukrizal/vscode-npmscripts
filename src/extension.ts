'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { first, forOwn } from 'lodash';
import { readFileSync } from 'fs';
import * as path from 'path';

const { window, workspace } = vscode;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    const rootDir = first(workspace.workspaceFolders || []);

    // NPM Script instance
    let npmScript = new NpmScripts();

    // Get npm scripts from package.json
    if (rootDir) {
        npmScript.read(path.join(rootDir.uri.path, 'package.json'))
            .updateStatusBar();

        let disposable = vscode.commands.registerCommand('extension.npmScripts', () => {
            window.showQuickPick(npmScript.scripts(), {
                placeHolder: 'Select npm script to run...'
            }).then(npmScript.run.bind(npmScript));
        });
        context.subscriptions.push(workspace.onDidCloseTextDocument(npmScript.watcher.bind(npmScript)));
        context.subscriptions.push(workspace.onDidChangeTextDocument(npmScript.watcher.bind(npmScript)));
        context.subscriptions.push(disposable);
    }
    
    context.subscriptions.push(npmScript);
}

// this method is called when your extension is deactivated
export function deactivate() { }

interface Script {
    [key: string]: string;
}

interface Package {
    scripts: Script;
}

interface Item {
    name: string;
    command: string;
}

class NpmScripts implements vscode.Disposable {
    private _statusBarItem: vscode.StatusBarItem =  window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    private _terminal: vscode.Terminal[] = [];
    private _content: Package = { scripts: {} };
    private _scripts: Item[] = [];
    private _path: string = '';

    private _execId: any = 0;

    constructor() {
        this._statusBarItem.command = 'extension.npmScripts';
    }

    public run(command: string) {
        if (command) {
            const terminal = window.createTerminal();
            terminal.show();
            terminal.sendText(`npm run ${command}`, true);
            this._terminal.push(terminal);
        }
    }

    public scripts() {
        return this._scripts.map((item) => item.name);
    }

    public watcher(subject: vscode.TextDocument | vscode.TextEditor | undefined) {
        if (this._execId) {
            clearTimeout(this._execId);
        }
        this._execId = setTimeout(() => {
            let update = false;
            if (subject) {
                if ((<vscode.TextDocument>subject).fileName
                    && (<vscode.TextDocument>subject).fileName.indexOf('package.json') >= 0) {
                        update = true;
                } else {
                    const document = (<vscode.TextEditor>subject).document;
                    if (document && document.fileName.indexOf('package.json') >= 0) {
                        update = true;
                    }
                }
                
            }
    
            if (update) {
                this.read(undefined).updateStatusBar();
            }
        }, 10);
    }

    public read(packageJsonPath: string | undefined) {
        if (packageJsonPath) {
            this._path = packageJsonPath;
        }
        this._content = JSON.parse(readFileSync(this._path, 'utf8'));
        this._scripts = [];
        forOwn(this._content.scripts,  (command, name) => {
            this._scripts.push({ command, name });
        });

        return this;
    }

    public updateStatusBar() {
        if (this._scripts.length > 0) {
            this._statusBarItem.text = `npm scripts[${this._scripts.length}]`;
            this._statusBarItem.show();
        } else {
            this._statusBarItem.hide();
        }
    }

    dispose() {
        this._statusBarItem.dispose();
        this._terminal.forEach(terminal => terminal.dispose());
    }
}
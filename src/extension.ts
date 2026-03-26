import * as vscode from 'vscode';
import * as path from 'path';
import { generateCrudFromLLM } from './llm';

export async function activate(context: vscode.ExtensionContext) {
  const generate = vscode.commands.registerCommand('crudGenerator.generate', async () => {
    const config = vscode.workspace.getConfiguration('crudGenerator');

    // 1. Pick framework
    const lang = await vscode.window.showQuickPick(
      ['Node.js + Express', 'Spring Boot', 'Django', 'FastAPI'],
      { placeHolder: 'Select backend stack' }
    );
    if (!lang) return;

    // 2. Pick parent directory
    const folderUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select parent directory for generated CRUD',
    });
    if (!folderUris || !folderUris[0]) return;
    const parentDirUri = folderUris[0];  // e.g., file:///path/to/my-project

    // 3. Entity name
    const entity = await vscode.window.showInputBox({
      placeHolder: 'Entity name (e.g., User, Product)',
      prompt: 'Enter the entity to generate CRUD for',
    });
    if (!entity) return;

    // 4. Fields
    const fields = await vscode.window.showInputBox({
      placeHolder: 'Fields (comma‑separated, e.g., name:string,age:number)',
      prompt: 'Define model fields',
    });
    if (!fields) return;

    // 5. Ask LLM for CRUD code (as before)
    const code = await generateCrudFromLLM(lang, entity, fields);
    if (!code) {
      vscode.window.showErrorMessage('No code generated from LLM.');
      return;
    }

    const dirName = `${entity.toLowerCase()}`;
    const dirUri = vscode.Uri.joinPath(parentDirUri, dirName);
    await vscode.workspace.fs.createDirectory(dirUri);

    const encoder = new TextEncoder();
    let createdAnyFile = false;

    // LLM returns JSON mapping file paths to content when asking for repo structure
    try {
      const files = JSON.parse(code) as Record<string, string>;
      if (files && typeof files === 'object') {
        for (const [relativePath, content] of Object.entries(files)) {
          const fileUri = vscode.Uri.joinPath(dirUri, ...relativePath.split('/'));
          const folderUri = vscode.Uri.joinPath(dirUri, ...relativePath.split('/').slice(0, -1));
          await vscode.workspace.fs.createDirectory(folderUri);
          await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));
          createdAnyFile = true;
        }
      }
    } catch (err) {
      // fallback for old behavior: single-file output
    }

    if (!createdAnyFile) {
      const fallbackFile = vscode.Uri.joinPath(dirUri, 'README.md');
      await vscode.workspace.fs.writeFile(fallbackFile, encoder.encode(code));
      const doc = await vscode.workspace.openTextDocument(fallbackFile);
      await vscode.window.showTextDocument(doc);
      return;
    }

    const firstFile = vscode.Uri.joinPath(dirUri, Object.keys(JSON.parse(code))[0]);
    const doc = await vscode.workspace.openTextDocument(firstFile);
    await vscode.window.showTextDocument(doc);
  });

  context.subscriptions.push(generate);
}

// In extension.ts activate function
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) return;
  if (warning.name === 'ExperimentalWarning' && warning.message.includes('SQLite')) return;
  console.warn(warning);
});

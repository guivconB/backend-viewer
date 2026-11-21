import * as path from 'path';
import * as vscode from 'vscode';
import { traceSymbolAtLine } from './analyzer/tracer';

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Backend Flow Viewer');
	context.subscriptions.push(outputChannel);

	console.log('[Backend Flow Viewer] Extensão ativada com sucesso.');

	const traceCommand = vscode.commands.registerCommand(
		'backend-viewer.traceSymbolAtCursor',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage(
					'Backend Viewer: Abra um arquivo TypeScript no editor antes de executar o comando.'
				);
				return;
			}

			const document = editor.document;
			const filePath = document.uri.fsPath;
			// VS Code usa 0-indexed para linhas/colunas; ts-morph usa 1-indexed
			const lineNumber = editor.selection.active.line + 1;
			const columnNumber = editor.selection.active.character + 1;
			const unsavedContent = document.isDirty ? document.getText() : undefined;

			outputChannel.show(true);
			outputChannel.appendLine('------------------------------------------------------------');
			outputChannel.appendLine(
				`[Tracer] Analisando: ${filePath} (Linha ${lineNumber}, Coluna ${columnNumber})`
			);

			try {
				const results = traceSymbolAtLine(
					filePath,
					lineNumber,
					columnNumber,
					unsavedContent
				);

				if (results.length === 0) {
					const msg = `Nenhuma definição de símbolo encontrada na linha ${lineNumber}.`;
					console.log(`[Backend Flow Viewer] ${msg}`);
					outputChannel.appendLine(`[Tracer] ${msg}`);
					vscode.window.showInformationMessage(`Backend Viewer: ${msg}`);
					return;
				}

				console.log('[Backend Flow Viewer] Definições encontradas:', results);

				for (const [index, item] of results.entries()) {
					const logEntry = [
						`  #${index + 1} Símbolo: ${item.symbolName} (${item.kind})`,
						`     Destino: ${item.targetFilePath}:${item.targetLine}:${item.targetColumn}`,
						`     Preview: ${item.previewText}`,
					].join('\n');

					outputChannel.appendLine(logEntry);
				}

				const primary = results[0];
				const relativeFile = vscode.workspace.asRelativePath(primary.targetFilePath, false);
				const action = await vscode.window.showInformationMessage(
					`Símbolo: ${primary.symbolName} (${primary.kind}) → ${ path.basename(relativeFile) }:${primary.targetLine}`,
					'Abrir Definição'
				);

				if (action === 'Abrir Definição') {
					const targetDoc = await vscode.workspace.openTextDocument(
						vscode.Uri.file(primary.targetFilePath)
					);
					const targetPos = new vscode.Position(
						Math.max(0, primary.targetLine - 1),
						Math.max(0, primary.targetColumn - 1)
					);
					await vscode.window.showTextDocument(targetDoc, {
						selection: new vscode.Range(targetPos, targetPos),
						viewColumn: vscode.ViewColumn.Active,
					});
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error('[Backend Flow Viewer] Erro ao rastrear símbolo:', error);
				outputChannel.appendLine(`[Tracer][ERRO] ${errorMessage}`);
				vscode.window.showErrorMessage(
					`Backend Viewer: Falha ao analisar AST — ${errorMessage}`
				);
			}
		}
	);

	context.subscriptions.push(traceCommand);
}

export function deactivate() {}

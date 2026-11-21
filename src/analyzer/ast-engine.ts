import * as fs from 'fs';
import * as path from 'path';
import { Project, SourceFile, ts } from 'ts-morph';

/**
 * Gerencia a instância do Project do ts-morph para análise estática de arquivos TypeScript.
 * Localiza automaticamente o tsconfig.json mais próximo ou cria uma configuração padrão em memória.
 */
export class AstEngine {
	private static instance: AstEngine | undefined;
	private projectsByConfig = new Map<string, Project>();
	private fallbackProject: Project | undefined;

	public static getInstance(): AstEngine {
		if (!AstEngine.instance) {
			AstEngine.instance = new AstEngine();
		}
		return AstEngine.instance;
	}

	/**
	 * Obtém (ou inicializa) o Project do ts-morph apropriado para o arquivo informado.
	 */
	public getProjectForFile(filePath: string): Project {
		const tsConfigPath = this.findNearestTsConfig(path.dirname(filePath));

		if (tsConfigPath) {
			const normalizedConfig = path.normalize(tsConfigPath);
			let project = this.projectsByConfig.get(normalizedConfig);
			if (!project) {
				project = new Project({
					tsConfigFilePath: normalizedConfig,
					skipAddingFilesFromTsConfig: false,
				});
				this.projectsByConfig.set(normalizedConfig, project);
			}
			return project;
		}

		if (!this.fallbackProject) {
			this.fallbackProject = new Project({
				compilerOptions: {
					target: ts.ScriptTarget.ES2022,
					module: ts.ModuleKind.Node16,
					moduleResolution: ts.ModuleResolutionKind.Node16,
					allowJs: true,
					esModuleInterop: true,
					resolveJsonModule: true,
					skipLibCheck: true,
				},
			});
		}

		return this.fallbackProject;
	}

	/**
	 * Carrega ou atualiza um SourceFile no Project do ts-morph.
	 * Se unsavedContent for fornecido (ex.: buffer sujo do editor), atualiza em memória.
	 */
	public getSourceFile(filePath: string, unsavedContent?: string): SourceFile {
		const normalizedPath = path.normalize(filePath);
		const project = this.getProjectForFile(normalizedPath);

		let sourceFile = project.getSourceFile(normalizedPath);

		if (unsavedContent !== undefined) {
			if (sourceFile) {
				sourceFile.replaceWithText(unsavedContent);
			} else {
				sourceFile = project.createSourceFile(normalizedPath, unsavedContent, { overwrite: true });
			}
			return sourceFile;
		}

		if (!sourceFile) {
			sourceFile = project.addSourceFileAtPath(normalizedPath);
		} else {
			sourceFile.refreshFromFileSystemSync();
		}

		return sourceFile;
	}

	/**
	 * Busca recursivamente o tsconfig.json mais próximo subindo na árvore de diretórios.
	 */
	private findNearestTsConfig(startDir: string): string | undefined {
		let currentDir = path.resolve(startDir);

		while (true) {
			const candidate = path.join(currentDir, 'tsconfig.json');
			if (fs.existsSync(candidate)) {
				return candidate;
			}

			const parentDir = path.dirname(currentDir);
			if (parentDir === currentDir) {
				break;
			}
			currentDir = parentDir;
		}

		return undefined;
	}
}

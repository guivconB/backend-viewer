import {
	Identifier,
	Node,
	SourceFile,
	SyntaxKind,
} from 'ts-morph';
import { AstEngine } from './ast-engine';

/**
 * Representa o resultado da resolução de definição de um símbolo sob o cursor.
 */
export interface SymbolDefinitionResult {
	/** Nome do identificador/símbolo encontrado */
	symbolName: string;
	/** Tipo do nó de definição na AST (ex.: MethodDeclaration, FunctionDeclaration) */
	kind: string;
	/** Caminho absoluto do arquivo onde o símbolo foi definido/declarado */
	targetFilePath: string;
	/** Linha (1-indexed) da definição no arquivo de destino */
	targetLine: number;
	/** Coluna (1-indexed) da definição no arquivo de destino */
	targetColumn: number;
	/** Trecho da linha de código onde o símbolo está definido */
	previewText: string;
}

/**
 * Localiza o identificador sob o cursor (ou na linha informada) usando ts-morph
 * e resolve sua definição/declaração original (inclusive através de imports entre arquivos).
 *
 * @param filePath Caminho absoluto do arquivo TypeScript sendo analisado
 * @param lineNumber Número da linha onde o cursor está (1-indexed)
 * @param columnNumber Número da coluna onde o cursor está (1-indexed, opcional)
 * @param unsavedContent Conteúdo atual do buffer do editor caso não esteja salvo (opcional)
 */
export function traceSymbolAtLine(
	filePath: string,
	lineNumber: number,
	columnNumber?: number,
	unsavedContent?: string
): SymbolDefinitionResult[] {
	const engine = AstEngine.getInstance();
	const sourceFile = engine.getSourceFile(filePath, unsavedContent);

	const candidateIdentifiers = collectCandidateIdentifiers(
		sourceFile,
		lineNumber,
		columnNumber
	);

	const results: SymbolDefinitionResult[] = [];
	const seenKeys = new Set<string>();

	for (const identifier of candidateIdentifiers) {
		const definitions = resolveIdentifierDefinitions(identifier);

		for (const defNode of definitions) {
			const defSourceFile = defNode.getSourceFile();
			const targetFilePath = defSourceFile.getFilePath();
			const targetLine = defNode.getStartLineNumber();
			const startPos = defNode.getStart();
			const lineAndChar = defSourceFile.compilerNode.getLineAndCharacterOfPosition(startPos);
			const targetColumn = lineAndChar.character + 1;
			const symbolName = extractDefinitionName(defNode, identifier.getText());
			const kind = defNode.getKindName();

			const dedupeKey = `${targetFilePath}:${targetLine}:${symbolName}`;
			if (seenKeys.has(dedupeKey)) {
				continue;
			}
			seenKeys.add(dedupeKey);

			const previewText = getFirstLinePreview(defNode);

			results.push({
				symbolName,
				kind,
				targetFilePath,
				targetLine,
				targetColumn,
				previewText,
			});
		}
	}

	return results;
}

/**
 * Coleta os identificadores candidatos na posição exata do cursor e/ou na linha indicada,
 * ordenados por relevância (ex.: identificador exato sob o cursor primeiro, depois chamadas de método/função).
 */
function collectCandidateIdentifiers(
	sourceFile: SourceFile,
	lineNumber: number,
	columnNumber?: number
): Identifier[] {
	const candidates: Identifier[] = [];
	const addedPositions = new Set<number>();

	const pushIdentifier = (id: Identifier | undefined) => {
		if (!id) {
			return;
		}
		const pos = id.getStart();
		if (!addedPositions.has(pos)) {
			addedPositions.add(pos);
			candidates.push(id);
		}
	};

	// 1. Tenta localizar o identificador exatamente sob a coluna do cursor
	if (columnNumber !== undefined && columnNumber >= 1) {
		const exactId = findIdentifierAtCursor(sourceFile, lineNumber, columnNumber);
		if (exactId) {
			// Se o cursor estiver no objeto de um PropertyAccessExpression (ex.: "userController" em "userController.create"),
			// incluímos tanto o identificador exato sob o cursor quanto o método/propriedade acessada.
			pushIdentifier(exactId);

			const parent = exactId.getParent();
			if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === exactId) {
				const nameNode = parent.getNameNode();
				if (Node.isIdentifier(nameNode)) {
					pushIdentifier(nameNode);
				}
			}
		}
	}

	// 2. Coleta todos os identificadores presentes na linha para fallback ou quando columnNumber não é informado
	const lineIdentifiers = sourceFile
		.getDescendantsOfKind(SyntaxKind.Identifier)
		.filter((id) => id.getStartLineNumber() === lineNumber);

	// Ordena por prioridade arquitetural (handlers de rota, métodos chamados, funções invocadas)
	lineIdentifiers.sort((a, b) => scoreIdentifierRelevance(b) - scoreIdentifierRelevance(a));

	for (const id of lineIdentifiers) {
		pushIdentifier(id);
	}

	return candidates;
}

/**
 * Busca o Identifier na posição (lineNumber, columnNumber) (ambos 1-indexed).
 */
function findIdentifierAtCursor(
	sourceFile: SourceFile,
	lineNumber: number,
	columnNumber: number
): Identifier | undefined {
	const lineStarts = sourceFile.compilerNode.getLineStarts();
	if (lineNumber < 1 || lineNumber > lineStarts.length) {
		return undefined;
	}

	const lineZero = lineNumber - 1;
	const lineStartPos = lineStarts[lineZero];
	const lineEndPos =
		lineZero + 1 < lineStarts.length
			? lineStarts[lineZero + 1]
			: sourceFile.getFullWidth();
	const maxColumnOffset = Math.max(0, lineEndPos - lineStartPos - 1);
	const safeCharZero = Math.min(Math.max(0, columnNumber - 1), maxColumnOffset);

	const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(lineZero, safeCharZero);

	// Testa a posição exata e 1 caractere antes (caso o cursor esteja imediatamente após a palavra, ex.: antes de '(' ou ';')
	const offsetsToTry = [pos, Math.max(lineStartPos, pos - 1)];

	for (const offset of offsetsToTry) {
		const node = sourceFile.getDescendantAtPos(offset);
		if (!node) {
			continue;
		}
		if (Node.isIdentifier(node) && node.getStartLineNumber() === lineNumber) {
			return node;
		}
		const parentId = node.getFirstAncestorByKind(SyntaxKind.Identifier);
		if (parentId && parentId.getStartLineNumber() === lineNumber) {
			return parentId;
		}
	}

	return undefined;
}

/**
 * Pontua a relevância de um identificador em uma linha para priorizar chamadas a Controllers/Services
 * sobre objetos de roteamento como `router` ou `app`.
 */
function scoreIdentifierRelevance(id: Identifier): number {
	const text = id.getText();
	const parent = id.getParent();

	// Desprioriza objetos e métodos padrões do Express caso haja handlers na mesma linha
	const expressRouters = new Set(['app', 'router', 'route', 'req', 'res', 'next']);
	const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'use', 'all']);

	if (expressRouters.has(text)) {
		return 1;
	}

	if (Node.isPropertyAccessExpression(parent)) {
		// Ex.: router.get('/users', userController.create)
		if (parent.getNameNode() === id) {
			if (httpMethods.has(text)) {
				return 2;
			}
			// É o nome do método/propriedade (ex.: `.create`) -> altíssima prioridade
			return 100;
		}
		// É o objeto da expressão (ex.: `userController`)
		return 60;
	}

	if (Node.isCallExpression(parent) && parent.getExpression() === id) {
		// Chamada direta de função: ex.: createUser(req, res)
		return 90;
	}

	if (Node.isCallExpression(parent) && parent.getArguments().includes(id)) {
		// Handler passado diretamente como argumento: ex.: router.get('/users', listUsers)
		return 95;
	}

	return 30;
}

/**
 * Resolve os nós de definição reais de um Identifier utilizando o TypeChecker/LanguageService do ts-morph.
 * Desempacota cláusulas de import/export para chegar ao arquivo onde o símbolo realmente reside.
 */
function resolveIdentifierDefinitions(identifier: Identifier): Node[] {
	const resolvedNodes: Node[] = [];
	const seenNodePositions = new Set<string>();

	const addNode = (node: Node) => {
		const unwrapped = unwrapImportOrAlias(node);
		for (const target of unwrapped) {
			const key = `${target.getSourceFile().getFilePath()}:${target.getStart()}`;
			if (!seenNodePositions.has(key)) {
				seenNodePositions.add(key);
				resolvedNodes.push(target);
			}
		}
	};

	// 1. Usa getDefinitionNodes() do ts-morph (baseado no LanguageService do TypeScript)
	try {
		const defNodes = identifier.getDefinitionNodes();
		for (const defNode of defNodes) {
			addNode(defNode);
		}
	} catch {
		// Fallback silencioso para resolução via Symbol caso o LanguageService falhe em algum nó parcial
	}

	// 2. Complementa via Symbol / AliasedSymbol caso getDefinitionNodes() não tenha retornado resultados
	if (resolvedNodes.length === 0) {
		const symbol = identifier.getSymbol();
		if (symbol) {
			const targetSymbol = symbol.getAliasedSymbol() ?? symbol;
			for (const decl of targetSymbol.getDeclarations()) {
				addNode(decl);
			}
		}
	}

	return resolvedNodes;
}

/**
 * Caso um nó de definição seja apenas uma cláusula de importação (ImportSpecifier, ImportClause, etc.),
 * segue o símbolo original (aliased symbol) para encontrar a declaração real no arquivo de origem.
 */
function unwrapImportOrAlias(node: Node): Node[] {
	if (
		Node.isImportSpecifier(node) ||
		Node.isImportClause(node) ||
		Node.isNamespaceImport(node) ||
		Node.isExportSpecifier(node)
	) {
		const symbol = node.getSymbol();
		const aliased = symbol?.getAliasedSymbol();
		if (aliased) {
			const decls = aliased.getDeclarations();
			if (decls.length > 0) {
				return decls;
			}
		}
	}

	return [node];
}

/**
 * Extrai um nome legível para o símbolo definido (incluindo o nome da classe caso seja um método).
 */
function extractDefinitionName(defNode: Node, fallbackName: string): string {
	if (Node.isMethodDeclaration(defNode) || Node.isPropertyDeclaration(defNode)) {
		const classDecl = defNode.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
		const className = classDecl?.getName();
		const memberName = defNode.getName();
		return className ? `${className}.${memberName}` : memberName;
	}

	if (
		Node.isFunctionDeclaration(defNode) ||
		Node.isClassDeclaration(defNode) ||
		Node.isInterfaceDeclaration(defNode) ||
		Node.isTypeAliasDeclaration(defNode) ||
		Node.isVariableDeclaration(defNode) ||
		Node.isPropertyAssignment(defNode) ||
		Node.isShorthandPropertyAssignment(defNode)
	) {
		return defNode.getName() ?? fallbackName;
	}

	return fallbackName;
}

/**
 * Retorna a primeira linha limpa do nó de definição para exibição rápida no log/output.
 */
function getFirstLinePreview(node: Node): string {
	const firstLine = node.getText().split(/\r?\n/)[0] ?? '';
	return firstLine.trim().slice(0, 120);
}

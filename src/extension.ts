import * as vscode from 'vscode';

const SECTION_REGEX = /^\s*~\s*(.+)$/;
const GOTO_WORD_REGEX = /[\w.-]+/;

export function activate(context: vscode.ExtensionContext) {
  const helloWorldCommand = vscode.commands.registerCommand(
    'godotDialogueManager.helloWorld',
    () => {
      vscode.window.showInformationMessage(
        'Godot Dialogue Manager Files extension activated!'
      );
    }
  );

  const symbolProvider = vscode.languages.registerDocumentSymbolProvider(
    { language: 'godotDialogue' },
    new DialogueDocumentSymbolProvider()
  );

  const definitionProvider = vscode.languages.registerDefinitionProvider(
    { language: 'godotDialogue' },
    new DialogueDefinitionProvider()
  );

  context.subscriptions.push(
    helloWorldCommand,
    symbolProvider,
    definitionProvider
  );
}

export function deactivate() {}

type SectionInfo = {
  name: string;
  normalizedName: string;
  line: number;
  char: number;
};

function parseSections(document: vscode.TextDocument): SectionInfo[] {
  const sections: SectionInfo[] = [];

  for (let line = 0; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    const tildeIndex = text.indexOf('~');
    const match = SECTION_REGEX.exec(text);
    if (match && tildeIndex > -1) {
      const name = match[1].trim() || '(untitled section)';
      sections.push({
        name,
        normalizedName: normalizeName(name),
        line,
        char: tildeIndex,
      });
    }
  }

  return sections;
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, '_').trim().toLowerCase();
}

class DialogueDocumentSymbolProvider
  implements vscode.DocumentSymbolProvider
{
  provideDocumentSymbols(
    document: vscode.TextDocument
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    const sections = parseSections(document);

    return sections.map((section, index) => {
      const computedEndLine =
        index + 1 < sections.length
          ? sections[index + 1].line - 1
          : document.lineCount - 1;
      const endLine = Math.max(section.line, computedEndLine);
      const startPosition = new vscode.Position(section.line, section.char);
      const endPosition = new vscode.Position(
        endLine,
        document.lineAt(endLine).text.length
      );
      const range = new vscode.Range(startPosition, endPosition);

      return new vscode.DocumentSymbol(
        section.name,
        'Dialogue block',
        vscode.SymbolKind.Namespace,
        range,
        new vscode.Range(startPosition, startPosition)
      );
    });
  }
}

class DialogueDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Definition> {
    const line = document.lineAt(position.line);
    if (!line.text.includes('=>')) {
      return undefined;
    }

    const wordRange =
      document.getWordRangeAtPosition(position, GOTO_WORD_REGEX);
    if (!wordRange) {
      return undefined;
    }

    const targetName = document.getText(wordRange);
    const sections = parseSections(document);

    const exactMatch = findSection(targetName, sections);
    if (!exactMatch) {
      return undefined;
    }

    const targetPosition = new vscode.Position(
      exactMatch.line,
      exactMatch.char
    );
    return new vscode.Location(document.uri, targetPosition);
  }
}

function findSection(
  target: string,
  sections: SectionInfo[]
): SectionInfo | undefined {
  const normalizedTarget = normalizeName(target);
  return (
    sections.find((section) => section.normalizedName === normalizedTarget) ??
    sections.find((section) =>
      section.name.toLowerCase().startsWith(target.toLowerCase())
    )
  );
}


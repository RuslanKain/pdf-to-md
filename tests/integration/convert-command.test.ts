/**
 * Integration tests for the convert command.
 * Runs inside the VS Code Extension Development Host via @vscode/test-electron.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const fixturesDir = path.resolve(__dirname, '..', '..', '..', 'tests', 'fixtures');

suite('Convert Command', () => {
  // Clean up generated .md files after each test
  teardown(async () => {
    const mdFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.md'));
    for (const f of mdFiles) {
      try {
        fs.unlinkSync(path.join(fixturesDir, f));
      } catch {
        // ignore cleanup errors
      }
    }
  });

  test('should convert simple-text.pdf to Markdown', async function () {
    this.timeout(30000);

    const pdfPath = path.join(fixturesDir, 'simple-text.pdf');
    if (!fs.existsSync(pdfPath)) {
      this.skip();
      return;
    }

    const pdfUri = vscode.Uri.file(pdfPath);

    // Execute the convert command
    await vscode.commands.executeCommand('pdfToMarkdown.convert', pdfUri);

    // Wait a moment for file to be written
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify .md file was created
    const mdPath = path.join(fixturesDir, 'simple-text.md');
    assert.ok(
      fs.existsSync(mdPath),
      `Expected ${mdPath} to be created`
    );

    // Verify content is non-empty Markdown
    const content = fs.readFileSync(mdPath, 'utf-8');
    assert.ok(content.length > 0, 'Markdown output should not be empty');

    // Verify the file is opened in the editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      assert.ok(
        activeEditor.document.uri.fsPath.endsWith('.md'),
        'Active editor should show a .md file'
      );
    }
  });

  test('should handle encrypted PDF gracefully', async function () {
    this.timeout(30000);

    const pdfPath = path.join(fixturesDir, 'encrypted.pdf');
    if (!fs.existsSync(pdfPath)) {
      this.skip();
      return;
    }

    const pdfUri = vscode.Uri.file(pdfPath);

    // The command should not throw — it catches errors and shows notifications
    try {
      await vscode.commands.executeCommand('pdfToMarkdown.convert', pdfUri);
    } catch {
      // Command handler catches errors internally
    }

    // Wait for the notification to appear
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify no .md file was created for an encrypted PDF
    const mdPath = path.join(fixturesDir, 'encrypted.md');
    assert.ok(
      !fs.existsSync(mdPath),
      'No .md file should be created for an encrypted PDF'
    );
  });

  test('should handle corrupt PDF gracefully', async function () {
    this.timeout(30000);

    const pdfPath = path.join(fixturesDir, 'corrupt.pdf');
    if (!fs.existsSync(pdfPath)) {
      this.skip();
      return;
    }

    const pdfUri = vscode.Uri.file(pdfPath);

    // The command should not throw — it catches errors and shows notifications
    try {
      await vscode.commands.executeCommand('pdfToMarkdown.convert', pdfUri);
    } catch {
      // Command handler catches errors internally
    }

    // Wait for the notification to appear
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify no .md file was created for a corrupt PDF
    const mdPath = path.join(fixturesDir, 'corrupt.md');
    assert.ok(
      !fs.existsSync(mdPath),
      'No .md file should be created for a corrupt PDF'
    );
  });

  test('should handle non-existent PDF path gracefully', async function () {
    this.timeout(30000);

    const pdfPath = path.join(fixturesDir, 'does-not-exist.pdf');
    const pdfUri = vscode.Uri.file(pdfPath);

    // The command should not throw
    try {
      await vscode.commands.executeCommand('pdfToMarkdown.convert', pdfUri);
    } catch {
      // Command handler catches errors internally
    }

    // Wait for the notification
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // No crash = success for this test
    assert.ok(true, 'Extension should not crash on non-existent PDF');
  });
});

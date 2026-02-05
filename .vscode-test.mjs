import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/tests/integration/**/*.test.js',
  version: 'stable',
  mocha: {
    ui: 'tdd',
    timeout: 20000,
  },
  workspaceFolder: './tests/fixtures',
});

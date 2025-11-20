// vscode-extension/extension.js
// Minimal VS Code extension that watches story files and notifies backend.

const vscode = require('vscode');
const http = require('http');

function notifyBackend(pathRel) {
  const data = JSON.stringify({ path: pathRel, ts: Date.now() });
  const opts = {
    hostname: 'localhost',
    port: 3456,
    path: '/__vscode_notify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = http.request(opts, res => {});
  req.on('error', () => {});
  req.write(data);
  req.end();
}

function activate(context) {
  console.log('Story Sync extension activated');

  // Auto-open UI on activation
  vscode.env.openExternal(vscode.Uri.parse("http://localhost:3456"));

  // -----------------------------
  // Register Commands
  // -----------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("storySync.openUI", () => {
      vscode.env.openExternal(vscode.Uri.parse("http://localhost:3456"));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("storySync.syncNow", () => {
      notifyBackend('__manual_sync');
      vscode.window.showInformationMessage('Forced sync request sent.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("storySync.ping", () => {
      notifyBackend('__manual_ping');
      vscode.window.showInformationMessage('Ping sent to backend.');
    })
  );

  // -----------------------------
  // File Watchers
  // -----------------------------
  const patterns = [
    '**/data/story.txt',
    '**/data/story_outline.txt',
    '**/data/index.json',
    '**/frontend/index.html'
  ];

  const watchers = patterns.map(p =>
    vscode.workspace.createFileSystemWatcher(p, false, false, false)
  );

  for (const w of watchers) {
    context.subscriptions.push(
      w.onDidChange(uri => notifyBackend(uri.fsPath)),
      w.onDidCreate(uri => notifyBackend(uri.fsPath)),
      w.onDidDelete(uri => notifyBackend(uri.fsPath))
    );
  }
}

function deactivate() {
  console.log('Story Sync extension deactivated');
}

module.exports = { activate, deactivate };

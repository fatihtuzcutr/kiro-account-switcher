import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function initLogger(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Kiro Account Switcher');
  }
  return channel;
}

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

export function logInfo(msg: string, data?: Record<string, unknown>): void {
  const line = data ? `[${ts()}] ${msg} ${JSON.stringify(data)}` : `[${ts()}] ${msg}`;
  channel?.appendLine(line);
}

export function logWarn(msg: string, data?: Record<string, unknown>): void {
  const line = data ? `[${ts()}] ⚠ ${msg} ${JSON.stringify(data)}` : `[${ts()}] ⚠ ${msg}`;
  channel?.appendLine(line);
}

export function logError(msg: string, err?: unknown): void {
  const detail = err instanceof Error ? `${err.message}` : err !== undefined ? String(err) : '';
  channel?.appendLine(`[${ts()}] ✖ ${msg}${detail ? ': ' + detail : ''}`);
}

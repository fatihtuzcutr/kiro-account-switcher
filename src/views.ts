import * as vscode from 'vscode';
import { ActiveDiskState, SavedAccountMetadata, UsageSummary } from './types';

export interface SwitcherViewState {
  accounts: SavedAccountMetadata[];
  activeAccountId?: string;
  activeDisk: ActiveDiskState;
  activeUsage?: UsageSummary;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatUsageShort(usage?: UsageSummary): string | undefined {
  if (!usage || usage.used === undefined || usage.limit === undefined || usage.limit <= 0) {
    return undefined;
  }
  return `${fmt(usage.used)}/${fmt(usage.limit)}`;
}

function usagePercent(usage?: UsageSummary): number | undefined {
  if (!usage || usage.used === undefined || usage.limit === undefined || usage.limit <= 0) {
    return undefined;
  }
  return Math.min(100, Math.round((usage.used / usage.limit) * 100));
}

function usageColor(pct: number | undefined): vscode.ThemeColor | undefined {
  if (pct === undefined) return undefined;
  if (pct >= 100) return new vscode.ThemeColor('charts.red');
  if (pct >= 90) return new vscode.ThemeColor('charts.orange');
  if (pct >= 75) return new vscode.ThemeColor('charts.yellow');
  return undefined;
}

function progressBar(pct: number, width = 10): string {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export class AccountTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly kind: 'activeHeader' | 'unsavedActive' | 'account' | 'empty',
    public readonly account?: SavedAccountMetadata
  ) {
    super(label, collapsibleState);
  }
}

export class AccountsTreeProvider implements vscode.TreeDataProvider<AccountTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<AccountTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private state: SwitcherViewState = { accounts: [], activeDisk: {} };

  setState(next: SwitcherViewState): void {
    this.state = next;
    vscode.commands.executeCommand('setContext', 'kiroAccountSwitcher.noAccounts', next.accounts.length === 0);
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AccountTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): AccountTreeItem[] {
    const items: AccountTreeItem[] = [];
    const { accounts, activeAccountId, activeDisk, activeUsage } = this.state;
    const hasToken = Boolean(activeDisk.token?.accessToken);

    // --- Status header ---
    if (hasToken && !activeAccountId) {
      const label = activeUsage?.email || activeDisk.token?.provider || 'Active Session';
      const item = new AccountTreeItem(label, vscode.TreeItemCollapsibleState.None, 'unsavedActive');
      const pct = usagePercent(activeUsage);
      item.description = [
        'Unsaved',
        formatUsageShort(activeUsage),
        pct !== undefined ? `${pct}%` : undefined,
      ].filter(Boolean).join(' · ');
      item.iconPath = new vscode.ThemeIcon('sparkle', new vscode.ThemeColor('charts.blue'));
      item.contextValue = 'unsavedActive';
      item.command = { command: 'kiroAccountSwitcher.saveCurrent', title: 'Save' };
      item.tooltip = new vscode.MarkdownString('**Unsaved session** — click `+` to save');
      items.push(item);
    } else if (hasToken && activeAccountId) {
      const acc = accounts.find((a) => a.id === activeAccountId);
      const item = new AccountTreeItem(
        acc?.label || 'Kiro',
        vscode.TreeItemCollapsibleState.None,
        'activeHeader'
      );
      const usage = acc?.usage || activeUsage;
      const pct = usagePercent(usage);
      const parts = [
        acc?.usage?.planName || acc?.provider,
        formatUsageShort(usage),
        pct !== undefined ? `${pct}%` : undefined,
      ].filter(Boolean);
      item.description = parts.join(' · ');
      item.iconPath = new vscode.ThemeIcon(
        'pass-filled',
        usageColor(pct) || new vscode.ThemeColor('charts.green')
      );
      item.contextValue = 'activeHeader';
      item.tooltip = buildAccountTooltip(acc, usage, true);
      items.push(item);
    }

    // --- Account list (always render, welcome view handles empty state) ---
    for (const acc of accounts) {
      const isActive = acc.id === activeAccountId;
      const item = new AccountTreeItem(acc.label, vscode.TreeItemCollapsibleState.None, 'account', acc);

      const pct = usagePercent(acc.usage);
      const descParts: string[] = [];
      if (isActive) descParts.push('✓');
      if (acc.email && acc.email !== acc.label) descParts.push(acc.email);
      const usageStr = formatUsageShort(acc.usage);
      if (usageStr) descParts.push(usageStr);
      if (pct !== undefined) descParts.push(`${pct}%`);
      item.description = descParts.join(' · ');

      item.iconPath = isActive
        ? new vscode.ThemeIcon('check', usageColor(pct) || new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('account');
      item.contextValue = isActive ? 'accountActive' : 'accountInactive';

      if (!isActive) {
        item.command = {
          command: 'kiroAccountSwitcher.switchAccount',
          title: 'Switch',
          arguments: [item],
        };
      }
      item.tooltip = buildAccountTooltip(acc, acc.usage, isActive);
      item.accessibilityInformation = {
        label: `${acc.label}${isActive ? ', active' : ''}, ${usageStr || 'no usage data'}`,
      };
      items.push(item);
    }

    return items;
  }
}

function buildAccountTooltip(
  acc: SavedAccountMetadata | undefined,
  usage: UsageSummary | undefined,
  isActive: boolean
): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = true;
  md.supportThemeIcons = true;

  const name = acc?.label || 'Kiro';
  md.appendMarkdown(`### $(account) ${name}${isActive ? '  $(pass-filled)' : ''}\n\n`);

  if (acc?.email) md.appendMarkdown(`$(mail) ${acc.email}  \n`);
  if (acc?.provider) md.appendMarkdown(`$(key) ${acc.provider}  \n`);
  if (usage?.planName) md.appendMarkdown(`$(credit-card) ${usage.planName}  \n`);

  const pct = usagePercent(usage);
  const usageStr = formatUsageShort(usage);
  if (pct !== undefined && usageStr) {
    md.appendMarkdown(`\n---\n`);
    md.appendMarkdown(`\`[${progressBar(pct)}]\` **${usageStr}** (${pct}%)  \n`);
    if (usage?.breakdownTitle) md.appendMarkdown(`*${usage.breakdownTitle}*  \n`);
    if (usage?.resetDate) {
      md.appendMarkdown(`$(calendar) Resets: ${new Date(usage.resetDate).toLocaleDateString()}  \n`);
    }
  }

  if (acc?.lastUsedAt) {
    md.appendMarkdown(`\n---\n`);
    md.appendMarkdown(`$(history) Last used ${relativeTime(acc.lastUsedAt)}`);
  }

  if (acc?.userId) {
    md.appendMarkdown(`\n\n$(clippy) \`${acc.userId}\``);
  }

  return md;
}

export class StatusBarController {
  private item: vscode.StatusBarItem;

  constructor() {
    const align = this.getAlignment();
    this.item = vscode.window.createStatusBarItem(align, 100);
    this.item.command = 'kiroAccountSwitcher.quickSwitch';
    this.item.name = 'Kiro Account';
    this.item.show();
  }

  private getAlignment(): vscode.StatusBarAlignment {
    const cfg = vscode.workspace.getConfiguration('kiroAccountSwitcher');
    return cfg.get<string>('statusBarAlignment', 'right') === 'left'
      ? vscode.StatusBarAlignment.Left
      : vscode.StatusBarAlignment.Right;
  }

  update(state: SwitcherViewState): void {
    const { accounts, activeAccountId, activeDisk, activeUsage } = state;

    if (!activeDisk.token?.accessToken) {
      this.item.text = '$(account) Kiro: —';
      this.item.tooltip = buildStatusBarTooltip(undefined, undefined, 0);
      this.item.backgroundColor = undefined;
      return;
    }

    const activeAcc = accounts.find((a) => a.id === activeAccountId);
    const usage = activeAcc?.usage || activeUsage;
    const displayName = activeAcc?.label || activeUsage?.email || activeDisk.token.provider || 'Kiro';
    const pct = usagePercent(usage);
    const usageStr = formatUsageShort(usage);

    const shortName = displayName.length > 16 ? displayName.slice(0, 14) + '…' : displayName;
    this.item.text = usageStr
      ? `$(account) ${shortName}  ${usageStr}`
      : `$(account) ${shortName}`;

    if (pct !== undefined && pct >= 100) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (pct !== undefined && pct >= 90) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.backgroundColor = undefined;
    }

    this.item.tooltip = buildStatusBarTooltip(activeAcc, usage, accounts.length);
  }

  dispose(): void {
    this.item.dispose();
  }
}

function buildStatusBarTooltip(
  acc: SavedAccountMetadata | undefined,
  usage: UsageSummary | undefined,
  totalAccounts: number
): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = true;
  md.supportThemeIcons = true;

  md.appendMarkdown(`### $(account) Kiro Account Switcher\n\n`);

  if (!acc) {
    md.appendMarkdown(`*No saved account active*\n\n`);
    md.appendMarkdown(`$(add) [Save current session](command:kiroAccountSwitcher.saveCurrent)  \n`);
    if (totalAccounts > 0) {
      md.appendMarkdown(`$(arrow-swap) [Switch account](command:kiroAccountSwitcher.quickSwitch)  \n`);
    }
    return md;
  }

  md.appendMarkdown(`**${acc.label}**  \n`);
  if (acc.email) md.appendMarkdown(`$(mail) ${acc.email}  \n`);

  const pct = usagePercent(usage);
  const usageStr = formatUsageShort(usage);
  if (pct !== undefined && usageStr) {
    const showBar = vscode.workspace.getConfiguration('kiroAccountSwitcher').get<boolean>('showProgressBar', true);
    if (showBar) {
      md.appendMarkdown(`\n\`[${progressBar(pct, 14)}]\` ${pct}%  \n`);
    }
    md.appendMarkdown(`$(pulse) ${usageStr}${usage?.unit ? ` ${usage.unit}` : ''}  \n`);
    if (usage?.planName) md.appendMarkdown(`$(credit-card) ${usage.planName}  \n`);
    if (usage?.resetDate) {
      md.appendMarkdown(`$(calendar) Resets ${new Date(usage.resetDate).toLocaleDateString()}  \n`);
    }
  }

  if (totalAccounts > 1) {
    md.appendMarkdown(`\n---\n$(arrow-swap) [Switch](command:kiroAccountSwitcher.quickSwitch) · `);
    md.appendMarkdown(`$(refresh) [Refresh](command:kiroAccountSwitcher.refresh)\n`);
  }

  return md;
}

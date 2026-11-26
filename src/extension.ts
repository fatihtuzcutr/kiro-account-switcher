import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { getWebviewStrings, getLang, initI18n, setLang, t } from './i18n';
import { fetchUsageLimits, isSocialToken, isTokenExpired, refreshSocialToken } from './kiroApi';
import { initLogger, logError, logInfo, logWarn } from './logger';
import {
  AccountVault,
  clearActiveDiskState,
  getCodeTokenPath,
  getGlobalTokenPath,
  getSsoCacheDir,
  readActiveDiskState,
  writeActiveDiskState,
} from './storage';
import { AccountSecretBundle, ActiveDiskState, KiroAuthToken, SavedAccountMetadata, UsageSummary } from './types';
import { formatUsageShort, StatusBarController } from './views';
import { SidebarWebviewProvider } from './webviewPanel';

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('kiroAccountSwitcher');
  return {
    syncBothTokenFiles: cfg.get<boolean>('syncBothTokenFiles', true),
    fetchEmailAndQuota: cfg.get<boolean>('fetchEmailAndQuota', true),
    autoReloadWindowOnSwitch: cfg.get<boolean>('autoReloadWindowOnSwitch', false),
  };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = initLogger();
  context.subscriptions.push(outputChannel);
  const savedLang = context.globalState.get<string>('kiroAccountSwitcher.lang');
  initI18n(savedLang);
  logInfo('Kiro Account Switcher activating');

  const vault = new AccountVault(context);
  const initialAccounts = vault.getAccounts();
  let currentActiveAccountId: string | undefined;
  let currentActiveDisk: ActiveDiskState = readActiveDiskState();
  let currentActiveUsage: UsageSummary | undefined;

  const webviewProvider = new SidebarWebviewProvider(
    context.extensionUri,
    getWebviewStrings(),
    getLang(),
    {
      accounts: initialAccounts,
      activeDisk: currentActiveDisk,
      totalAccounts: initialAccounts.length,
    }
  );
  const statusBar = new StatusBarController();

  context.subscriptions.push(
    statusBar,
    webviewProvider,
    vscode.window.registerWebviewViewProvider(SidebarWebviewProvider.viewType, webviewProvider)
  );

  // Quick initial status bar and account match
  statusBar.update({
    accounts: initialAccounts,
    activeAccountId: undefined,
    activeDisk: currentActiveDisk,
  });

  void vault.findMatchingAccountId(currentActiveDisk.token).then((matchedId) => {
    if (matchedId) {
      currentActiveAccountId = matchedId;
      pushViewUpdate();
    }
  });

  // Handle messages from webview
  webviewProvider.onMessage(async (msg) => {
    switch (msg.command) {
      case 'ready':
        pushViewUpdate();
        break;
      case 'switch':
        if (msg.id) await switchToAccount(msg.id);
        break;
      case 'save':
        await saveCurrentAccount();
        break;
      case 'refresh':
        await syncAndRefresh({ fetchRemote: true });
        break;
      case 'refreshOne':
        if (msg.id) await refreshSingleAccount(msg.id);
        break;
      case 'rename':
        if (msg.id) {
          const accounts = vault.getAccounts();
          const target = accounts.find((a) => a.id === msg.id);
          if (!target) break;
          const newLabel = await vscode.window.showInputBox({
            title: t('renameTitle'),
            value: target.label,
            validateInput: (v) => (v.trim().length === 0 ? t('inputEmpty') : undefined),
          });
          if (!newLabel) break;
          await vault.saveAccounts(accounts.map((a) =>
            a.id === msg.id ? { ...a, label: newLabel.trim(), updatedAt: Date.now() } : a
          ));
          pushViewUpdate();
        }
        break;
      case 'delete':
        if (msg.id) {
          const accounts = vault.getAccounts();
          const target = accounts.find((a) => a.id === msg.id);
          if (!target) break;
          const confirm = await vscode.window.showWarningMessage(
            t('deleteConfirm', target.label), { modal: true }, t('deleteBtn')
          );
          if (confirm !== t('deleteBtn')) break;
          await vault.deleteSecretBundle(msg.id);
          await vault.saveAccounts(accounts.filter((a) => a.id !== msg.id));
          if (currentActiveAccountId === msg.id) currentActiveAccountId = undefined;
          pushViewUpdate();
          logInfo('Account deleted', { label: target.label });
        }
        break;
      case 'copyUserId':
        if (msg.id) {
          const acc = vault.getAccounts().find((a) => a.id === msg.id);
          if (acc?.userId) {
            await vscode.env.clipboard.writeText(acc.userId);
            vscode.window.showInformationMessage(t('userIdCopied'));
          } else {
            vscode.window.showWarningMessage(t('noUserId'));
          }
        }
        break;
      case 'moveUp':
        if (msg.id) await moveAccountById(msg.id, -1);
        break;
      case 'moveDown':
        if (msg.id) await moveAccountById(msg.id, 1);
        break;
      case 'signOut':
        await signOutCurrent();
        break;
      case 'export':
        await exportAccounts();
        break;
      case 'import':
        await importAccounts();
        break;
      case 'reorder':
        if (msg.id && msg.targetId) {
          const accounts = vault.getAccounts();
          const fromIdx = accounts.findIndex((a) => a.id === msg.id);
          const toIdx = accounts.findIndex((a) => a.id === msg.targetId);
          if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
            const [moved] = accounts.splice(fromIdx, 1);
            accounts.splice(toIdx, 0, moved);
            await vault.saveAccounts(accounts);
            pushViewUpdate();
          }
        }
        break;
      case 'sortUsageAsc': {
        const accounts = vault.getAccounts();
        accounts.sort((a, b) => {
          const pa = a.usage?.limit ? (a.usage.used ?? 0) / a.usage.limit : 0;
          const pb = b.usage?.limit ? (b.usage.used ?? 0) / b.usage.limit : 0;
          return pa - pb;
        });
        await vault.saveAccounts(accounts);
        pushViewUpdate();
        break;
      }
      case 'sortUsageDesc': {
        const accounts = vault.getAccounts();
        accounts.sort((a, b) => {
          const pa = a.usage?.limit ? (a.usage.used ?? 0) / a.usage.limit : 0;
          const pb = b.usage?.limit ? (b.usage.used ?? 0) / b.usage.limit : 0;
          return pb - pa;
        });
        await vault.saveAccounts(accounts);
        pushViewUpdate();
        break;
      }
      case 'sortAlpha': {
        const accounts = vault.getAccounts();
        accounts.sort((a, b) => a.label.localeCompare(b.label));
        await vault.saveAccounts(accounts);
        pushViewUpdate();
        break;
      }
      case 'toggleLang': {
        const next = getLang() === 'en' ? 'tr' : 'en';
        setLang(next);
        await context.globalState.update('kiroAccountSwitcher.lang', next);
        webviewProvider.updateStrings(getWebviewStrings(), next);
        pushViewUpdate();
        break;
      }
    }
  });

  // ── Token + usage resolution ──────────────────────────────────────

  async function resolveTokenAndUsage(token: KiroAuthToken): Promise<{
    token: KiroAuthToken;
    usage?: UsageSummary;
    error?: string;
  }> {
    let workingToken = token;
    const { fetchEmailAndQuota } = getConfig();
    if (!fetchEmailAndQuota) {
      return { token: workingToken };
    }

    if (isTokenExpired(workingToken) && isSocialToken(workingToken)) {
      try {
        workingToken = await refreshSocialToken(workingToken);
        logInfo('Token refreshed (expired)');
      } catch (err) {
        logWarn('Token refresh failed', { error: err instanceof Error ? err.message : String(err) });
        return { token: workingToken, error: err instanceof Error ? err.message : String(err) };
      }
    }

    try {
      const usage = await fetchUsageLimits(workingToken);
      logInfo('Usage fetched', { email: usage.email, used: usage.used, limit: usage.limit });
      return { token: workingToken, usage };
    } catch (err) {
      // Retry once with fresh token for social logins
      if (isSocialToken(workingToken) && workingToken.refreshToken) {
        try {
          workingToken = await refreshSocialToken(workingToken);
          const usage = await fetchUsageLimits(workingToken);
          return { token: workingToken, usage };
        } catch (retryErr) {
          logError('Usage fetch retry failed', retryErr);
          return { token: workingToken, error: retryErr instanceof Error ? retryErr.message : String(retryErr) };
        }
      }
      logError('Usage fetch failed', err);
      return { token: workingToken, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── View updates ──────────────────────────────────────────────────

  function pushViewUpdate(): void {
    const state = {
      accounts: vault.getAccounts(),
      activeAccountId: currentActiveAccountId,
      activeDisk: currentActiveDisk,
      activeUsage: currentActiveUsage,
    };
    webviewProvider.setState({ ...state, totalAccounts: state.accounts.length });
    statusBar.update(state);
  }

  // ── Sync & refresh (debounced) ────────────────────────────────────

  let refreshInFlight: Promise<void> | undefined;
  let refreshInFlightRemote = false;
  let queuedRemoteRefresh: Promise<void> | undefined;

  async function syncAndRefresh(options: { fetchRemote?: boolean } = {}): Promise<void> {
    const wantRemote = options.fetchRemote !== false;

    if (refreshInFlight) {
      if (refreshInFlightRemote || !wantRemote) {
        return refreshInFlight;
      }
      if (!queuedRemoteRefresh) {
        queuedRemoteRefresh = refreshInFlight.then(() => syncAndRefresh({ fetchRemote: true })).finally(() => {
          queuedRemoteRefresh = undefined;
        });
      }
      return queuedRemoteRefresh;
    }

    refreshInFlightRemote = wantRemote;
    refreshInFlight = (async () => {
      try {
        currentActiveDisk = readActiveDiskState();
        currentActiveUsage = undefined;

        if (!currentActiveDisk.token) {
          currentActiveAccountId = undefined;
          pushViewUpdate();
          return;
        }

        // Fast local match first
        currentActiveAccountId = await vault.findMatchingAccountId(currentActiveDisk.token);
        pushViewUpdate();

        const { fetchEmailAndQuota } = getConfig();
        if (wantRemote && fetchEmailAndQuota) {
          const resolved = await resolveTokenAndUsage(currentActiveDisk.token);
          currentActiveUsage = resolved.usage;

          const matchedId = await vault.findMatchingAccountId(resolved.token, resolved.usage?.userId);
          currentActiveAccountId = matchedId;

          if (matchedId) {
            const accounts = vault.getAccounts();
            const idx = accounts.findIndex((a) => a.id === matchedId);
            if (idx !== -1) {
              const existing = accounts[idx];
              const existingSecret = await vault.getSecretBundle(matchedId);
              await vault.setSecretBundle(matchedId, {
                token: resolved.token,
                connection: currentActiveDisk.connection ?? existingSecret?.connection,
                profile: currentActiveDisk.profile ?? existingSecret?.profile,
              });
              accounts[idx] = {
                ...existing,
                email: resolved.usage?.email || existing.email,
                userId: resolved.usage?.userId || existing.userId,
                provider: resolved.token.provider || existing.provider,
                authMethod: resolved.token.authMethod || existing.authMethod,
                profileArn: resolved.token.profileArn || existing.profileArn,
                usage: resolved.usage ?? existing.usage,
                updatedAt: Date.now(),
              };
              await vault.saveAccounts(accounts);
            }
          }
          pushViewUpdate();
        }
      } catch (err) {
        logError('syncAndRefresh failed', err);
      } finally {
        refreshInFlight = undefined;
        refreshInFlightRemote = false;
      }
    })();

    return refreshInFlight;
  }

  // ── Core actions ──────────────────────────────────────────────────

  async function saveCurrentAccount(): Promise<SavedAccountMetadata | undefined> {
    const disk = readActiveDiskState();
    if (!disk.token?.accessToken) {
      vscode.window.showWarningMessage(t('noSession'));
      return undefined;
    }

    const resolved = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: t('readingAccount') },
      () => resolveTokenAndUsage(disk.token!)
    );

    const accounts = vault.getAccounts();
    const existingId = await vault.findMatchingAccountId(resolved.token, resolved.usage?.userId);
    let existingAcc = existingId ? accounts.find((a) => a.id === existingId) : undefined;

    if (existingAcc) {
      const choice = await vscode.window.showInformationMessage(
        t('matchFound', existingAcc.label),
        { modal: true },
        t('updateExisting'),
        t('saveAsNew')
      );
      if (!choice) return undefined;
      if (choice === t('saveAsNew')) {
        existingAcc = undefined;
      }
    }

    const defaultLabel =
      existingAcc?.label ||
      resolved.usage?.email ||
      `${resolved.token.provider || 'Kiro'} Account ${accounts.length + 1}`;

    const label = await vscode.window.showInputBox({
      title: existingAcc ? t('updateAccount') : t('saveAccount'),
      prompt: t('inputPrompt'),
      value: defaultLabel,
      validateInput: (v) => (v.trim().length === 0 ? t('inputEmpty') : undefined),
    });
    if (!label) return undefined;

    const now = Date.now();
    const id = existingAcc?.id || randomUUID();
    const metadata: SavedAccountMetadata = {
      id,
      label: label.trim(),
      email: resolved.usage?.email || existingAcc?.email,
      userId: resolved.usage?.userId || existingAcc?.userId,
      provider: resolved.token.provider || existingAcc?.provider,
      authMethod: resolved.token.authMethod || existingAcc?.authMethod,
      profileArn: resolved.token.profileArn || existingAcc?.profileArn,
      usage: resolved.usage ?? existingAcc?.usage,
      createdAt: existingAcc?.createdAt ?? now,
      updatedAt: now,
      lastUsedAt: now,
    };

    await vault.setSecretBundle(id, { token: resolved.token, connection: disk.connection, profile: disk.profile });
    await vault.saveAccounts(existingAcc ? accounts.map((a) => (a.id === id ? metadata : a)) : [...accounts, metadata]);

    currentActiveAccountId = id;
    currentActiveDisk = { ...disk, token: resolved.token };
    currentActiveUsage = resolved.usage ?? currentActiveUsage;
    pushViewUpdate();

    logInfo('Account saved', { id, label: metadata.label, email: metadata.email });
    vscode.window.showInformationMessage(t('saved', metadata.label, metadata.email ? ` (${metadata.email})` : ''));
    return metadata;
  }

  async function switchToAccount(accountId: string): Promise<void> {
    const accounts = vault.getAccounts();
    const target = accounts.find((a) => a.id === accountId);
    if (!target) { vscode.window.showErrorMessage(t('accountNotFound')); return; }

    const bundle = await vault.getSecretBundle(accountId);
    if (!bundle?.token) {
      vscode.window.showErrorMessage(t('credentialsMissing', target.label));
      return;
    }

    const { syncBothTokenFiles, autoReloadWindowOnSwitch, fetchEmailAndQuota } = getConfig();

    let nextBundle: AccountSecretBundle = bundle;
    let freshUsage: UsageSummary | undefined;
    let refreshError: string | undefined;

    if (isTokenExpired(bundle.token) && isSocialToken(bundle.token) && bundle.token.refreshToken) {
      try {
        const refreshed = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: t('refreshingToken', target.label) },
          () => refreshSocialToken(bundle.token)
        );
        nextBundle = { ...bundle, token: refreshed };
        logInfo('Token refreshed before switch', { label: target.label });
      } catch (err) {
        refreshError = err instanceof Error ? err.message : String(err);
        logWarn('Token refresh failed before switch', { label: target.label, error: refreshError });
      }
    }

    if (fetchEmailAndQuota && !isTokenExpired(nextBundle.token)) {
      try {
        const usage = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: t('switchingTo', target.label) },
          () => fetchUsageLimits(nextBundle.token)
        );
        freshUsage = usage;
      } catch (err) {
        logWarn('Usage fetch failed during switch', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    await vault.setSecretBundle(accountId, nextBundle);
    writeActiveDiskState(nextBundle, syncBothTokenFiles);

    const now = Date.now();
    const updated: SavedAccountMetadata = {
      ...target,
      email: freshUsage?.email || target.email,
      userId: freshUsage?.userId || target.userId,
      usage: freshUsage ?? target.usage,
      updatedAt: now,
      lastUsedAt: now,
    };
    await vault.saveAccounts(accounts.map((a) => (a.id === accountId ? updated : a)));

    currentActiveAccountId = accountId;
    currentActiveDisk = readActiveDiskState();
    currentActiveUsage = updated.usage;
    pushViewUpdate();

    logInfo('Switched account', { id: accountId, label: updated.label });

    if (refreshError) {
      vscode.window.showWarningMessage(t('switchedBut', updated.label));
      return;
    }

    if (autoReloadWindowOnSwitch) {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
      return;
    }

    const remaining = updated.usage && updated.usage.limit !== undefined && updated.usage.used !== undefined
      ? t('creditsLeft', fmt(Math.max(0, updated.usage.limit - updated.usage.used)))
      : '';
    const parts = [remaining].filter(Boolean);
    vscode.window.showInformationMessage(
      `✓ ${updated.label}${parts.length ? ' — ' + parts.join(' · ') : ''}`
    );
  }

  async function refreshSingleAccount(accountId: string): Promise<void> {
    const accounts = vault.getAccounts();
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;

    const bundle = await vault.getSecretBundle(accountId);
    if (!bundle?.token) {
      vscode.window.showWarningMessage(t('noCredentials', target.label));
      return;
    }

    const resolved = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: t('refreshing', target.label) },
      () => resolveTokenAndUsage(bundle.token)
    );

    if (resolved.error && !resolved.usage) {
      vscode.window.showWarningMessage(t('refreshFailed', target.label, resolved.error));
      return;
    }

    const nextBundle = { ...bundle, token: resolved.token };
    await vault.setSecretBundle(accountId, nextBundle);

    const updated: SavedAccountMetadata = {
      ...target,
      email: resolved.usage?.email || target.email,
      userId: resolved.usage?.userId || target.userId,
      usage: resolved.usage ?? target.usage,
      updatedAt: Date.now(),
    };
    await vault.saveAccounts(accounts.map((a) => (a.id === accountId ? updated : a)));

    if (accountId === currentActiveAccountId) {
      writeActiveDiskState(nextBundle, getConfig().syncBothTokenFiles);
      currentActiveUsage = updated.usage;
    }
    pushViewUpdate();
  }

  async function signOutCurrent(): Promise<void> {
    const disk = readActiveDiskState();
    if (!disk.token?.accessToken) {
      vscode.window.showInformationMessage(t('alreadySignedOut'));
      return;
    }

    const matchedId = await vault.findMatchingAccountId(disk.token);
    if (!matchedId) {
      const action = await vscode.window.showWarningMessage(
        t('unsavedWarn'),
        { modal: true },
        t('saveAndSignOut'),
        t('signOutNoSave')
      );
      if (!action) return;
      if (action === t('saveAndSignOut')) {
        const saved = await saveCurrentAccount();
        if (!saved) return;
      }
    }

    clearActiveDiskState(getConfig().syncBothTokenFiles);
    currentActiveAccountId = undefined;
    currentActiveDisk = readActiveDiskState();
    currentActiveUsage = undefined;
    pushViewUpdate();

    logInfo('Signed out');
    vscode.window.showInformationMessage(t('signedOut'));
  }

  // ── Export / Import ───────────────────────────────────────────────

  function encryptExportData(data: unknown, passphrase: string) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(passphrase, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const jsonStr = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      version: 2,
      encrypted: true,
      algorithm: 'aes-256-gcm',
      kdf: 'scrypt',
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
      exportedAt: new Date().toISOString(),
    };
  }

  function decryptExportData(parsed: {
    salt: string;
    iv: string;
    authTag: string;
    ciphertext: string;
  }, passphrase: string): unknown {
    const salt = Buffer.from(parsed.salt, 'hex');
    const iv = Buffer.from(parsed.iv, 'hex');
    const authTag = Buffer.from(parsed.authTag, 'hex');
    const ciphertext = Buffer.from(parsed.ciphertext, 'hex');
    const key = crypto.scryptSync(passphrase, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  async function exportAccounts(): Promise<void> {
    const accounts = vault.getAccounts();
    if (accounts.length === 0) {
      vscode.window.showInformationMessage(t('noAccountsExport'));
      return;
    }

    const passphrase = await vscode.window.showInputBox({
      title: t('exportTitle'),
      prompt: t('exportPassPrompt'),
      password: true,
      ignoreFocusOut: true,
    });
    // If user cancelled the dialog (undefined), abort
    if (passphrase === undefined) return;

    if (!passphrase.trim()) {
      vscode.window.showWarningMessage(t('exportPlaintextWarning'));
    }

    const bundles: Array<{ metadata: SavedAccountMetadata; secret: AccountSecretBundle }> = [];
    for (const acc of accounts) {
      const secret = await vault.getSecretBundle(acc.id);
      if (secret) {
        bundles.push({ metadata: acc, secret });
      }
    }

    const baseData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: bundles,
    };

    const finalPayload = passphrase.trim()
      ? encryptExportData(baseData, passphrase.trim())
      : baseData;

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('kiro-accounts-export.json'),
      filters: { JSON: ['json'] },
      title: t('exportTitle'),
    });
    if (!uri) return;

    const content = JSON.stringify(finalPayload, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    logInfo('Accounts exported', { count: bundles.length, encrypted: Boolean(passphrase.trim()), path: uri.fsPath });
    vscode.window.showInformationMessage(t('exported', bundles.length));
  }

  // ── Kiro Desktop format converter ─────────────────────────────────

  interface KiroDesktopEntry {
    id?: string;
    email?: string;
    user_id?: string;
    login_provider?: string;
    tags?: string[];
    plan_name?: string;
    plan_tier?: string;
    credits_total?: number;
    credits_used?: number;
    usage_reset_at?: number;
    created_at?: number;
    last_used?: number;
    kiro_auth_token_raw?: KiroAuthToken & { userId?: string; loginHint?: string; tokenType?: string };
    kiro_profile_raw?: { arn: string; name: string };
    kiro_usage_raw?: {
      nextDateReset?: number;
      subscriptionInfo?: { subscriptionTitle?: string; type?: string };
      usageBreakdownList?: Array<{
        currentUsageWithPrecision?: number;
        usageLimitWithPrecision?: number;
        displayName?: string;
        unit?: string;
        nextDateReset?: number;
      }>;
      userInfo?: { email?: string; userId?: string };
    };
  }

  function convertDesktopEntry(entry: KiroDesktopEntry): { metadata: SavedAccountMetadata; secret: AccountSecretBundle } | undefined {
    const tokenRaw = entry.kiro_auth_token_raw;
    if (!tokenRaw?.accessToken || !tokenRaw?.refreshToken) return undefined;

    const token: KiroAuthToken = {
      accessToken: tokenRaw.accessToken,
      refreshToken: tokenRaw.refreshToken,
      expiresAt: tokenRaw.expiresAt || '',
      provider: tokenRaw.provider || entry.login_provider,
      authMethod: tokenRaw.authMethod || 'social',
      profileArn: tokenRaw.profileArn,
    };

    const profile = entry.kiro_profile_raw?.arn
      ? { arn: entry.kiro_profile_raw.arn, name: entry.kiro_profile_raw.name }
      : undefined;

    const breakdown = entry.kiro_usage_raw?.usageBreakdownList?.[0];
    const usage: UsageSummary | undefined = entry.credits_total !== undefined ? {
      email: entry.email,
      userId: entry.user_id,
      planName: entry.plan_name || entry.kiro_usage_raw?.subscriptionInfo?.subscriptionTitle,
      used: entry.credits_used ?? breakdown?.currentUsageWithPrecision,
      limit: entry.credits_total ?? breakdown?.usageLimitWithPrecision,
      unit: breakdown?.displayName || 'Credits',
      breakdownTitle: breakdown?.displayName ? `${breakdown.displayName} Usage` : undefined,
      resetDate: entry.usage_reset_at
        ? new Date(entry.usage_reset_at * 1000).toISOString()
        : breakdown?.nextDateReset
          ? new Date(breakdown.nextDateReset * 1000).toISOString()
          : undefined,
      fetchedAt: Date.now(),
    } : undefined;

    const now = Date.now();
    const label = entry.tags?.[0]
      ? `${entry.email || entry.login_provider || 'Kiro'} [${entry.tags.join(',')}]`
      : entry.email || `${entry.login_provider || 'Kiro'} Account`;

    const metadata: SavedAccountMetadata = {
      id: randomUUID(),
      label,
      email: entry.email,
      userId: entry.user_id,
      provider: entry.login_provider || token.provider,
      authMethod: token.authMethod,
      profileArn: token.profileArn,
      usage,
      createdAt: entry.created_at ? entry.created_at * 1000 : now,
      updatedAt: now,
      lastUsedAt: entry.last_used ? entry.last_used * 1000 : now,
    };

    return { metadata, secret: { token, profile } };
  }

  async function importAccounts(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { JSON: ['json'] },
      title: t('importTitle'),
    });
    if (!uris || uris.length === 0) return;

    const raw = Buffer.from(await vscode.workspace.fs.readFile(uris[0])).toString('utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      vscode.window.showErrorMessage(t('invalidJson'));
      return;
    }

    // Check for encrypted export format
    if (typeof parsed === 'object' && parsed !== null && (parsed as { encrypted?: boolean }).encrypted === true) {
      const pass = await vscode.window.showInputBox({
        title: t('importTitle'),
        prompt: t('importPassPrompt'),
        password: true,
        ignoreFocusOut: true,
      });
      if (!pass) return;
      try {
        parsed = decryptExportData(parsed as {
          salt: string;
          iv: string;
          authTag: string;
          ciphertext: string;
        }, pass.trim());
      } catch (err) {
        logError('Failed to decrypt imported backup', err);
        vscode.window.showErrorMessage(t('decryptFailed'));
        return;
      }
    }

    let entries: Array<{ metadata: SavedAccountMetadata; secret: AccountSecretBundle }> = [];

    // Detect format: Kiro Desktop (array with kiro_auth_token_raw) vs our format ({version, accounts})
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].kiro_auth_token_raw) {
      // Kiro Desktop format
      logInfo('Detected Kiro Desktop export format', { count: parsed.length });
      for (const entry of parsed as KiroDesktopEntry[]) {
        const converted = convertDesktopEntry(entry);
        if (converted) entries.push(converted);
      }
      if (entries.length === 0) {
        vscode.window.showWarningMessage(t('noValidDesktop'));
        return;
      }
    } else if (typeof parsed === 'object' && parsed !== null && 'accounts' in parsed) {
      // Our own format
      const ours = parsed as { accounts?: Array<{ metadata: SavedAccountMetadata; secret: AccountSecretBundle }> };
      if (!Array.isArray(ours.accounts) || ours.accounts.length === 0) {
        vscode.window.showWarningMessage(t('noAccountsImport'));
        return;
      }
      entries = ours.accounts.filter((e) => e.metadata && e.secret?.token);
    } else {
      vscode.window.showErrorMessage(t('unrecognizedFormat'));
      return;
    }

    const existing = vault.getAccounts();
    let imported = 0;
    let updated = 0;
    for (const entry of entries) {
      if (!entry.secret?.token) continue;
      const conflict = existing.find(
        (a) =>
          (a.userId && entry.metadata.userId && a.userId === entry.metadata.userId) ||
          (a.email && entry.metadata.email && a.email === entry.metadata.email)
      );
      if (conflict) {
        await vault.setSecretBundle(conflict.id, entry.secret);
        const idx = existing.findIndex((a) => a.id === conflict.id);
        existing[idx] = { ...entry.metadata, id: conflict.id, updatedAt: Date.now() };
        updated++;
      } else {
        // Always generate a fresh UUID for newly imported accounts to avoid ID collisions or spoofing
        const newId = randomUUID();
        await vault.setSecretBundle(newId, entry.secret);
        existing.push({ ...entry.metadata, id: newId, createdAt: entry.metadata.createdAt || Date.now(), updatedAt: Date.now() });
        imported++;
      }
    }

    await vault.saveAccounts(existing);
    pushViewUpdate();
    logInfo('Accounts imported', { imported, updated, total: entries.length });
    vscode.window.showInformationMessage(
      t('imported', imported, updated, entries.length)
    );
  }

  // ── QuickPick menu ────────────────────────────────────────────────

  async function showQuickPickMenu(): Promise<void> {
    await syncAndRefresh({ fetchRemote: false });

    interface SwitcherPickItem extends vscode.QuickPickItem {
      action?: 'save' | 'signOut' | 'refresh' | 'reload' | 'export' | 'import';
      accountId?: string;
    }

    const accounts = vault.getAccounts();
    const items: SwitcherPickItem[] = [];

    for (const acc of accounts) {
      const isActive = acc.id === currentActiveAccountId;
      const usageStr = formatUsageShort(acc.usage);
      items.push({
        label: `${isActive ? '$(check) ' : '$(account) '}${acc.label}`,
        description: [isActive ? t('active') : undefined, acc.provider, usageStr].filter(Boolean).join(' · '),
        detail: [acc.email, acc.usage?.planName].filter(Boolean).join(' — ') || undefined,
        accountId: acc.id,
      });
    }

    if (accounts.length > 0) {
      items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
    }

    items.push(
      { label: `$(add) ${t('qpSaveCurrent')}`, description: currentActiveDisk.token ? t('qpSaveDesc') : t('qpNoSession'), action: 'save' },
      { label: `$(sign-out) ${t('qpSignOut')}`, description: t('qpSignOutDesc'), action: 'signOut' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: `$(refresh) ${t('qpRefreshAll')}`, action: 'refresh' },
      { label: `$(cloud-upload) ${t('qpExport')}`, action: 'export' },
      { label: `$(cloud-download) ${t('qpImport')}`, action: 'import' },
      { label: `$(sync) ${t('qpReload')}`, action: 'reload' },
    );

    const picked = await vscode.window.showQuickPick(items, {
      title: t('quickPickTitle'),
      placeHolder: t('quickPickPlaceholder'),
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (!picked) return;

    if (picked.accountId) await switchToAccount(picked.accountId);
    else if (picked.action === 'save') await saveCurrentAccount();
    else if (picked.action === 'signOut') await signOutCurrent();
    else if (picked.action === 'refresh') await syncAndRefresh({ fetchRemote: true });
    else if (picked.action === 'export') await exportAccounts();
    else if (picked.action === 'import') await importAccounts();
    else if (picked.action === 'reload') await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  // ── Move up/down helpers ──────────────────────────────────────────

  async function moveAccountById(accountId: string, direction: -1 | 1): Promise<void> {
    const accounts = vault.getAccounts();
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= accounts.length) return;
    [accounts[idx], accounts[newIdx]] = [accounts[newIdx], accounts[idx]];
    await vault.saveAccounts(accounts);
    pushViewUpdate();
  }

  // ── Register all commands ─────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('kiroAccountSwitcher.quickSwitch', showQuickPickMenu),
    vscode.commands.registerCommand('kiroAccountSwitcher.saveCurrent', saveCurrentAccount),
    vscode.commands.registerCommand('kiroAccountSwitcher.refresh', () => syncAndRefresh({ fetchRemote: true })),
    vscode.commands.registerCommand('kiroAccountSwitcher.signOutCurrent', signOutCurrent),
    vscode.commands.registerCommand('kiroAccountSwitcher.exportAccounts', exportAccounts),
    vscode.commands.registerCommand('kiroAccountSwitcher.importAccounts', importAccounts),
    vscode.commands.registerCommand('kiroAccountSwitcher.openCacheFolder', () => {
      vscode.env.openExternal(vscode.Uri.file(getSsoCacheDir()));
    }),
    vscode.commands.registerCommand('kiroAccountSwitcher.switchAccount', async (idOrItem?: unknown) => {
      const id = typeof idOrItem === 'string' ? idOrItem : undefined;
      if (id) await switchToAccount(id);
      else await showQuickPickMenu();
    }),
    vscode.commands.registerCommand('kiroAccountSwitcher.refreshAccount', async (id?: string) => {
      if (id) await refreshSingleAccount(id);
    }),
    vscode.commands.registerCommand('kiroAccountSwitcher.renameAccount', async (id?: string) => {
      if (!id) return;
      const target = vault.getAccounts().find((a) => a.id === id);
      if (!target) return;
      const newLabel = await vscode.window.showInputBox({
        title: t('renameTitle'),
        value: target.label,
        validateInput: (v) => (v.trim().length === 0 ? t('inputEmpty') : undefined),
      });
      if (!newLabel) return;
      const accounts = vault.getAccounts().map((a) =>
        a.id === id ? { ...a, label: newLabel.trim(), updatedAt: Date.now() } : a
      );
      await vault.saveAccounts(accounts);
      pushViewUpdate();
    }),
    vscode.commands.registerCommand('kiroAccountSwitcher.deleteAccount', async (id?: string) => {
      if (!id) return;
      const target = vault.getAccounts().find((a) => a.id === id);
      if (!target) return;
      const confirm = await vscode.window.showWarningMessage(
        t('deleteConfirm', target.label),
        { modal: true },
        t('deleteBtn')
      );
      if (confirm !== t('deleteBtn')) return;
      await vault.deleteSecretBundle(id);
      await vault.saveAccounts(vault.getAccounts().filter((a) => a.id !== id));
      if (currentActiveAccountId === id) currentActiveAccountId = undefined;
      pushViewUpdate();
      logInfo('Account deleted', { label: target.label });
    }),
    vscode.commands.registerCommand('kiroAccountSwitcher.moveUp', (id?: string) => { if (id) moveAccountById(id, -1); }),
    vscode.commands.registerCommand('kiroAccountSwitcher.moveDown', (id?: string) => { if (id) moveAccountById(id, 1); }),
    vscode.commands.registerCommand('kiroAccountSwitcher.copyUserId', async (id?: string) => {
      const acc = id ? vault.getAccounts().find((a) => a.id === id) : undefined;
      if (!acc?.userId) {
        vscode.window.showWarningMessage(t('noUserId'));
        return;
      }
      await vscode.env.clipboard.writeText(acc.userId);
      vscode.window.showInformationMessage(t('userIdCopied'));
    }),
  );

  // ── Native file watcher (event-driven, zero polling overhead) ──

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const DEBOUNCE_MS = 1500;

  function onDiskTokenChange() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      logInfo('Token file change detected on disk');
      void syncAndRefresh({ fetchRemote: true });
    }, DEBOUNCE_MS);
  }

  const watchers: fs.FSWatcher[] = [];
  const ssoCacheDir = getSsoCacheDir();
  try {
    if (fs.existsSync(ssoCacheDir)) {
      const watcher = fs.watch(ssoCacheDir, { persistent: false }, (_event, filename) => {
        if (!filename) {
          onDiskTokenChange();
          return;
        }
        if (filename.includes('kiro-auth-token') || filename.includes('kiro-connection')) {
          onDiskTokenChange();
        }
      });
      watchers.push(watcher);
    }
  } catch (err) {
    logWarn('Directory watcher unavailable, falling back to file watchers', { error: String(err) });
    const watchedPaths = [getCodeTokenPath(), getGlobalTokenPath()];
    for (const p of watchedPaths) {
      try {
        if (fs.existsSync(p)) {
          watchers.push(fs.watch(p, { persistent: false }, onDiskTokenChange));
        }
      } catch {}
    }
  }

  context.subscriptions.push({
    dispose: () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      for (const w of watchers) {
        try { w.close(); } catch {}
      }
    },
  });

  // ── Initial load ──────────────────────────────────────────────────

  void syncAndRefresh({ fetchRemote: true });
  logInfo('Kiro Account Switcher activated');
}

export function deactivate(): void {
  // Handled by subscriptions
}

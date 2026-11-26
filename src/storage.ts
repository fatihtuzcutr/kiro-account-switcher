import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  AccountSecretBundle,
  ActiveDiskState,
  KiroAuthToken,
  KiroConnection,
  KiroProfile,
  SavedAccountMetadata,
} from './types';

const ACCOUNTS_KEY = 'kiroAccountSwitcher.accounts';
const SECRET_PREFIX = 'kiroAccountSwitcher.secret.';

export function getSsoCacheDir(): string {
  return path.join(os.homedir(), '.aws', 'sso', 'cache');
}

export function getCodeTokenPath(): string {
  return path.join(getSsoCacheDir(), 'kiro-auth-token-code.json');
}

export function getGlobalTokenPath(): string {
  return path.join(getSsoCacheDir(), 'kiro-auth-token.json');
}

export function getCodeConnectionPath(): string {
  return path.join(getSsoCacheDir(), 'kiro-connection-code.json');
}

export function getGlobalConnectionPath(): string {
  return path.join(getSsoCacheDir(), 'kiro-connection.json');
}

export function getKiroProfilePath(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Code', 'User', 'globalStorage', 'kiro.kiro-for-vscode', 'profile.json');
  }
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Code',
      'User',
      'globalStorage',
      'kiro.kiro-for-vscode',
      'profile.json'
    );
  }
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'Code', 'User', 'globalStorage', 'kiro.kiro-for-vscode', 'profile.json');
}

function readJsonSafe<T>(filePath: string): T | undefined {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      return undefined;
    }
    // Verify realpath to guard against directory symlink traversal
    const real = fs.realpathSync(filePath);
    const realStat = fs.statSync(real);
    if (!realStat.isFile()) {
      return undefined;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function atomicWriteJson(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  try {
    if (fs.lstatSync(filePath).isSymbolicLink()) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Target does not exist yet
  }

  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const payload = JSON.stringify(value, null, 2);
  try {
    fs.writeFileSync(tmpPath, payload, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
  } finally {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

function removeFileIfExists(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Ignore cleanup errors
  }
}

export function readActiveDiskState(): ActiveDiskState {
  const codeToken = readJsonSafe<KiroAuthToken>(getCodeTokenPath());
  const globalToken = readJsonSafe<KiroAuthToken>(getGlobalTokenPath());

  let token: KiroAuthToken | undefined;
  let sourceFile: string | undefined;

  if (codeToken && typeof codeToken.accessToken === 'string' && codeToken.accessToken) {
    token = codeToken;
    sourceFile = getCodeTokenPath();
  } else if (globalToken && typeof globalToken.accessToken === 'string' && globalToken.accessToken) {
    token = globalToken;
    sourceFile = getGlobalTokenPath();
  }

  const connection =
    readJsonSafe<KiroConnection>(getCodeConnectionPath()) ||
    readJsonSafe<KiroConnection>(getGlobalConnectionPath());

  const profileRaw = readJsonSafe<KiroProfile>(getKiroProfilePath());
  const profile =
    profileRaw && typeof profileRaw.arn === 'string' && typeof profileRaw.name === 'string'
      ? profileRaw
      : undefined;

  return { token, connection, profile, sourceFile };
}

// Strip extra fields from token before writing to disk — Kiro only expects these 6 keys
function sanitizeTokenForDisk(token: KiroAuthToken): Record<string, unknown> {
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
    provider: token.provider,
    authMethod: token.authMethod,
    profileArn: token.profileArn,
  };
}

export function writeActiveDiskState(bundle: AccountSecretBundle, syncBothTokenFiles: boolean): void {
  const cleanToken = sanitizeTokenForDisk(bundle.token);
  atomicWriteJson(getCodeTokenPath(), cleanToken);
  if (syncBothTokenFiles) {
    atomicWriteJson(getGlobalTokenPath(), cleanToken);
  }

  if (bundle.connection) {
    atomicWriteJson(getCodeConnectionPath(), bundle.connection);
    if (syncBothTokenFiles) {
      atomicWriteJson(getGlobalConnectionPath(), bundle.connection);
    }
  }
  // Don't delete connection/profile files if bundle doesn't have them —
  // they may have been created by Kiro itself

  if (bundle.profile) {
    atomicWriteJson(getKiroProfilePath(), bundle.profile);
  }
}

export function clearActiveDiskState(syncBothTokenFiles: boolean): void {
  removeFileIfExists(getCodeTokenPath());
  removeFileIfExists(getCodeConnectionPath());
  removeFileIfExists(getKiroProfilePath());
  if (syncBothTokenFiles) {
    removeFileIfExists(getGlobalTokenPath());
    removeFileIfExists(getGlobalConnectionPath());
  }
}

export class AccountVault {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getAccounts(): SavedAccountMetadata[] {
    const list = this.context.globalState.get<SavedAccountMetadata[]>(ACCOUNTS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  async saveAccounts(accounts: SavedAccountMetadata[]): Promise<void> {
    await this.context.globalState.update(ACCOUNTS_KEY, accounts);
  }

  async getSecretBundle(accountId: string): Promise<AccountSecretBundle | undefined> {
    const raw = await this.context.secrets.get(`${SECRET_PREFIX}${accountId}`);
    if (!raw) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as AccountSecretBundle;
    } catch {
      return undefined;
    }
  }

  async setSecretBundle(accountId: string, bundle: AccountSecretBundle): Promise<void> {
    await this.context.secrets.store(`${SECRET_PREFIX}${accountId}`, JSON.stringify(bundle));
  }

  async deleteSecretBundle(accountId: string): Promise<void> {
    await this.context.secrets.delete(`${SECRET_PREFIX}${accountId}`);
  }

  async findMatchingAccountId(
    activeToken: KiroAuthToken | undefined,
    resolvedUserId?: string
  ): Promise<string | undefined> {
    if (!activeToken) {
      return undefined;
    }

    const accounts = this.getAccounts();

    // Strongest match: userId (unique per Kiro account)
    if (resolvedUserId) {
      const byUserId = accounts.find((a) => a.userId && a.userId === resolvedUserId);
      if (byUserId) {
        return byUserId.id;
      }
    }

    // Token-level match: same refreshToken or accessToken
    for (const acc of accounts) {
      const secret = await this.getSecretBundle(acc.id);
      if (!secret?.token) {
        continue;
      }
      if (
        (activeToken.refreshToken && secret.token.refreshToken === activeToken.refreshToken) ||
        (activeToken.accessToken && secret.token.accessToken === activeToken.accessToken)
      ) {
        return acc.id;
      }
    }

    // profileArn match removed — too loose, causes cross-account overwrites

    return undefined;
  }
}

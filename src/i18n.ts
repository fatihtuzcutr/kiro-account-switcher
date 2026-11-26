import * as vscode from 'vscode';

type Messages = typeof en;

const en = {
  // ── Extension messages ──
  'noSession': 'No active Kiro session found. Please sign in to Kiro first.',
  'readingAccount': 'Reading Kiro account…',
  'matchFound': 'This session matches "{0}". Update it or save as a new account?',
  'updateExisting': 'Update Existing',
  'saveAsNew': 'Save as New',
  'updateAccount': 'Update Saved Account',
  'saveAccount': 'Save Current Account',
  'inputPrompt': 'Display name for this Kiro account',
  'inputEmpty': 'Name cannot be empty',
  'saved': 'Saved "{0}"{1}',
  'accountNotFound': 'Account not found.',
  'credentialsMissing': 'Credentials for "{0}" are missing. Delete and re-save it.',
  'refreshingToken': 'Refreshing token for {0}…',
  'switchingTo': 'Switching to {0}…',
  'switchedBut': 'Switched to "{0}" but token refresh failed. Kiro may need to re-authenticate.',
  'creditsLeft': '{0} credits left',
  'noCredentials': 'No credentials for "{0}".',
  'refreshing': 'Refreshing {0}…',
  'refreshFailed': 'Refresh failed for "{0}": {1}',
  'alreadySignedOut': 'Already signed out. Use Kiro panel to sign in, then save.',
  'unsavedWarn': 'Active session is not saved. Save first?',
  'saveAndSignOut': 'Save & Sign Out',
  'signOutNoSave': 'Sign Out Without Saving',
  'signedOut': 'Signed out. Use Kiro panel to sign into another account.',
  'noAccountsExport': 'No accounts to export.',
  'exportTitle': 'Export Kiro Accounts',
  'exported': 'Exported {0} account(s).',
  'importTitle': 'Import Kiro Accounts',
  'invalidJson': 'Invalid JSON file.',
  'noValidDesktop': 'No valid accounts found in the Kiro Desktop export.',
  'noAccountsImport': 'No accounts found in the file.',
  'unrecognizedFormat': 'Unrecognized file format. Expected Kiro Desktop export or Kiro Account Switcher export.',
  'imported': 'Imported {0} new, updated {1} existing account(s) ({2} total).',
  'exportPassPrompt': 'Optional passphrase to encrypt exported account tokens (recommended). Leave empty for unencrypted.',
  'importPassPrompt': 'Enter the passphrase used to encrypt this backup file:',
  'decryptFailed': 'Failed to decrypt backup. Incorrect passphrase or corrupted file.',
  'exportPlaintextWarning': 'Exporting without a passphrase leaves tokens unencrypted on disk.',
  'quickPickTitle': 'Kiro Account Switcher',
  'quickPickPlaceholder': 'Switch account or choose an action…',
  'qpSaveCurrent': 'Save Current Account',
  'qpSaveDesc': 'Save active session',
  'qpNoSession': 'No session',
  'qpSignOut': 'Sign Out & Add New',
  'qpSignOutDesc': 'Clear tokens, sign into another',
  'qpRefreshAll': 'Refresh All Quotas',
  'qpExport': 'Export Accounts',
  'qpImport': 'Import Accounts',
  'qpReload': 'Reload Window',
  'renameTitle': 'Rename Account',
  'deleteConfirm': 'Delete "{0}"?',
  'deleteBtn': 'Delete',
  'userIdCopied': 'User ID copied to clipboard.',
  'noUserId': 'No User ID available for this account.',
  'active': 'Active',
  // ── Webview strings ──
  'wv.switcher': 'Switcher',
  'wv.ready': 'ready',
  'wv.of': 'of',
  'wv.refreshAll': 'Refresh All',
  'wv.import': 'Import',
  'wv.saveCurrentAccount': 'Save Current Account',
  'wv.accounts': 'ACCOUNTS',
  'wv.unsaved': 'Unsaved — click Save to keep',
  'wv.save': 'Save',
  'wv.noAccounts': 'No accounts saved',
  'wv.noAccountsSub': 'Sign in to Kiro, then click + to save',
  'wv.active': 'Active',
  'wv.inactive': 'Inactive',
  'wv.use': 'Use',
  'wv.back': '← Back',
  'wv.used': 'Used',
  'wv.remaining': 'Remaining',
  'wv.reset': 'Reset',
  'wv.provider': 'Provider',
  'wv.lastUsed': 'Last used',
  'wv.savedOn': 'Saved',
  'wv.refresh': 'Refresh',
  'wv.rename': 'Rename',
  'wv.noUsageData': 'No usage data',
  'wv.sortLeast': 'Sort: least used first',
  'wv.sortMost': 'Sort: most used first',
  'wv.sortAZ': 'Sort: A→Z',
  'wv.dragReorder': 'Drag to reorder',
  'wv.ctxSwitch': 'Switch to this account',
  'wv.ctxRefresh': 'Refresh quota',
  'wv.ctxRename': 'Rename',
  'wv.ctxCopyId': 'Copy User ID',
  'wv.ctxMoveUp': 'Move up',
  'wv.ctxMoveDown': 'Move down',
  'wv.ctxSignOut': 'Sign out & add new',
  'wv.ctxDelete': 'Delete account',
  'wv.justNow': 'just now',
  'wv.activeSession': 'Active Session',
  'wv.connected': 'Connected',
  'wv.disconnected': 'Disconnected',
};

const tr: Messages = {
  'noSession': 'Aktif Kiro oturumu bulunamadı. Lütfen önce Kiro\'ya giriş yapın.',
  'readingAccount': 'Kiro hesabı okunuyor…',
  'matchFound': 'Bu oturum "{0}" ile eşleşiyor. Güncellensin mi yoksa yeni hesap olarak mı kaydedilsin?',
  'updateExisting': 'Mevcut Güncelle',
  'saveAsNew': 'Yeni Olarak Kaydet',
  'updateAccount': 'Kaydedilmiş Hesabı Güncelle',
  'saveAccount': 'Mevcut Hesabı Kaydet',
  'inputPrompt': 'Bu Kiro hesabı için görünen ad',
  'inputEmpty': 'Ad boş olamaz',
  'saved': '"{0}" kaydedildi{1}',
  'accountNotFound': 'Hesap bulunamadı.',
  'credentialsMissing': '"{0}" için kimlik bilgileri eksik. Silip yeniden kaydedin.',
  'refreshingToken': '{0} için token yenileniyor…',
  'switchingTo': '{0} hesabına geçiliyor…',
  'switchedBut': '"{0}" hesabına geçildi ancak token yenilemesi başarısız oldu. Kiro\'nun yeniden kimlik doğrulaması gerekebilir.',
  'creditsLeft': '{0} kredi kaldı',
  'noCredentials': '"{0}" için kimlik bilgisi yok.',
  'refreshing': '{0} yenileniyor…',
  'refreshFailed': '"{0}" yenilemesi başarısız: {1}',
  'alreadySignedOut': 'Zaten çıkış yapılmış. Giriş yapmak için Kiro panelini kullanın, sonra kaydedin.',
  'unsavedWarn': 'Aktif oturum kaydedilmemiş. Önce kaydedilsin mi?',
  'saveAndSignOut': 'Kaydet ve Çıkış Yap',
  'signOutNoSave': 'Kaydetmeden Çıkış Yap',
  'signedOut': 'Çıkış yapıldı. Başka bir hesaba girmek için Kiro panelini kullanın.',
  'noAccountsExport': 'Dışa aktarılacak hesap yok.',
  'exportTitle': 'Kiro Hesaplarını Dışa Aktar',
  'exported': '{0} hesap dışa aktarıldı.',
  'importTitle': 'Kiro Hesaplarını İçe Aktar',
  'invalidJson': 'Geçersiz JSON dosyası.',
  'noValidDesktop': 'Kiro Desktop dışa aktarmasında geçerli hesap bulunamadı.',
  'noAccountsImport': 'Dosyada hesap bulunamadı.',
  'unrecognizedFormat': 'Tanınmayan dosya biçimi. Kiro Desktop veya Kiro Account Switcher dışa aktarması bekleniyor.',
  'imported': '{0} yeni eklendi, {1} mevcut güncellendi ({2} toplam).',
  'exportPassPrompt': 'Dışa aktarılan hesapları şifrelemek için parola (önerilir). Şifresiz için boş bırakın.',
  'importPassPrompt': 'Bu yedek dosyasını çözmek için parolayı girin:',
  'decryptFailed': 'Yedek şifresi çözülemedi. Yanlış parola veya bozuk dosya.',
  'exportPlaintextWarning': 'Parola girmemek, tokenları diskte şifresiz bırakacaktır.',
  'quickPickTitle': 'Kiro Hesap Değiştirici',
  'quickPickPlaceholder': 'Hesap değiştirin veya bir eylem seçin…',
  'qpSaveCurrent': 'Mevcut Hesabı Kaydet',
  'qpSaveDesc': 'Aktif oturumu kaydet',
  'qpNoSession': 'Oturum yok',
  'qpSignOut': 'Çıkış Yap ve Yeni Ekle',
  'qpSignOutDesc': 'Tokenları temizle, başka hesapla gir',
  'qpRefreshAll': 'Tüm Kotaları Yenile',
  'qpExport': 'Hesapları Dışa Aktar',
  'qpImport': 'Hesapları İçe Aktar',
  'qpReload': 'Pencereyi Yeniden Yükle',
  'renameTitle': 'Hesabı Yeniden Adlandır',
  'deleteConfirm': '"{0}" silinsin mi?',
  'deleteBtn': 'Sil',
  'userIdCopied': 'Kullanıcı ID panoya kopyalandı.',
  'noUserId': 'Bu hesap için Kullanıcı ID mevcut değil.',
  'active': 'Aktif',
  'wv.switcher': 'Değiştirici',
  'wv.ready': 'hazır',
  'wv.of': '/',
  'wv.refreshAll': 'Tümünü Yenile',
  'wv.import': 'İçe Aktar',
  'wv.saveCurrentAccount': 'Mevcut Hesabı Kaydet',
  'wv.accounts': 'HESAPLAR',
  'wv.unsaved': 'Kaydedilmemiş — Kaydetmek için tıklayın',
  'wv.save': 'Kaydet',
  'wv.noAccounts': 'Kaydedilmiş hesap yok',
  'wv.noAccountsSub': 'Kiro\'ya giriş yapın, ardından + ile kaydedin',
  'wv.active': 'Aktif',
  'wv.inactive': 'Pasif',
  'wv.use': 'Kullan',
  'wv.back': '← Geri',
  'wv.used': 'Kullanılan',
  'wv.remaining': 'Kalan',
  'wv.reset': 'Sıfırlanma',
  'wv.provider': 'Sağlayıcı',
  'wv.lastUsed': 'Son kullanım',
  'wv.savedOn': 'Kaydedilme',
  'wv.refresh': 'Yenile',
  'wv.rename': 'Adlandır',
  'wv.noUsageData': 'Kullanım verisi yok',
  'wv.sortLeast': 'Sırala: az kullanılan önce',
  'wv.sortMost': 'Sırala: çok kullanılan önce',
  'wv.sortAZ': 'Sırala: A→Z',
  'wv.dragReorder': 'Sıralamak için sürükleyin',
  'wv.ctxSwitch': 'Bu hesaba geç',
  'wv.ctxRefresh': 'Kotayı yenile',
  'wv.ctxRename': 'Yeniden adlandır',
  'wv.ctxCopyId': 'Kullanıcı ID kopyala',
  'wv.ctxMoveUp': 'Yukarı taşı',
  'wv.ctxMoveDown': 'Aşağı taşı',
  'wv.ctxSignOut': 'Çıkış yap ve yeni ekle',
  'wv.ctxDelete': 'Hesabı sil',
  'wv.justNow': 'az önce',
  'wv.activeSession': 'Aktif Oturum',
  'wv.connected': 'Bağlı',
  'wv.disconnected': 'Bağlantı kesildi',
};

const bundles: Record<string, Messages> = { en, tr };

let current: Messages = en;
let currentLang = 'en';

export function initI18n(overrideLang?: string): void {
  if (overrideLang && bundles[overrideLang]) {
    current = bundles[overrideLang];
    currentLang = overrideLang;
    return;
  }
  const locale = vscode.env.language; // e.g. "tr", "en", "de"
  const lang = locale.split('-')[0]; // "tr-TR" → "tr"
  current = bundles[lang] || en;
  currentLang = bundles[lang] ? lang : 'en';
}

export function setLang(lang: string): void {
  current = bundles[lang] || en;
  currentLang = bundles[lang] ? lang : 'en';
}

export function t(key: keyof Messages, ...args: (string | number)[]): string {
  let msg = current[key] ?? en[key] ?? key;
  for (let i = 0; i < args.length; i++) {
    msg = msg.replace(`{${i}}`, String(args[i]));
  }
  return msg;
}

export function getLang(): string {
  return currentLang;
}

/** Returns a JSON-serializable dictionary of all wv.* keys for the webview */
export function getWebviewStrings(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (k.startsWith('wv.')) {
      result[k] = v;
    }
  }
  return result;
}

import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ActiveDiskState, SavedAccountMetadata, UsageSummary } from './types';

export interface WebviewState {
  accounts: SavedAccountMetadata[];
  activeAccountId?: string;
  activeDisk: ActiveDiskState;
  activeUsage?: UsageSummary;
  totalAccounts: number;
}

const AVATAR_COLORS = [
  '#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
];

function avatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initial(label: string): string {
  return (label[0] || '?').toUpperCase();
}

function usagePct(u?: UsageSummary): number | undefined {
  if (!u || u.used === undefined || u.limit === undefined || u.limit <= 0) return undefined;
  return Math.min(100, Math.round((u.used / u.limit) * 100));
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class SidebarWebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'kiroAccountSwitcher.webviewPanel';

  private _view?: vscode.WebviewView;
  private _state: WebviewState = { accounts: [], activeDisk: {}, totalAccounts: 0 };
  private _strings: Record<string, string>;
  private _lang: string;
  private _htmlInitialized = false;
  private _isWebviewReady = false;

  private readonly _onMessage = new vscode.EventEmitter<{ command: string; id?: string; targetId?: string }>();
  readonly onMessage = this._onMessage.event;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    strings: Record<string, string>,
    lang?: string,
    initialState?: WebviewState
  ) {
    this._strings = strings;
    this._lang = lang || 'en';
    if (initialState) {
      this._state = initialState;
    }
  }

  dispose(): void {
    this._onMessage.dispose();
  }

  updateStrings(strings: Record<string, string>, lang?: string): void {
    this._strings = strings;
    if (lang) this._lang = lang;
    this._htmlInitialized = false;
    this._isWebviewReady = false;
    this._render();
  }

  private s(key: string): string {
    return this._strings[key] || key;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    this._htmlInitialized = false;
    this._isWebviewReady = false;
    webviewView.webview.options = { enableScripts: true };
    webviewView.onDidDispose(() => {
      this._view = undefined;
      this._isWebviewReady = false;
      this._htmlInitialized = false;
    });
    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'ready') {
        this._isWebviewReady = true;
        this.postCurrentState();
      }
      this._onMessage.fire(msg);
    });
    this._render();
  }

  setState(state: WebviewState): void {
    this._state = state;
    if (this._view && this._isWebviewReady) {
      this.postCurrentState();
      return;
    }
    if (this._view && !this._htmlInitialized) {
      this._render();
    }
  }

  postCurrentState(): void {
    if (this._view && this._isWebviewReady) {
      this._view.webview.postMessage({
        type: 'stateUpdate',
        payload: this._getClientPayload(),
      });
    }
  }

  private _getClientPayload() {
    const { accounts, activeAccountId, activeDisk, activeUsage } = this._state;
    const hasToken = Boolean(activeDisk.token?.accessToken);
    let readyCount = 0;
    for (const acc of accounts) {
      const p = usagePct(acc.usage);
      if (p === undefined || p < 100) readyCount++;
    }

    return {
      activeAccountId,
      hasToken,
      readyCount,
      totalCount: accounts.length,
      unsavedName: activeUsage?.email || activeDisk.token?.provider || this.s('wv.activeSession'),
      accounts: accounts.map((a, i) => ({
        id: a.id,
        index: i + 1,
        label: a.label,
        email: a.email,
        userId: a.userId,
        provider: a.provider,
        planName: a.usage?.planName,
        used: a.usage?.used,
        limit: a.usage?.limit,
        unit: a.usage?.unit ?? 'Credits',
        resetDate: a.usage?.resetDate,
        fetchedAt: a.usage?.fetchedAt,
        lastUsedAt: a.lastUsedAt,
        createdAt: a.createdAt,
        isActive: a.id === activeAccountId,
        color: avatarColor(a.label + (a.email || '')),
        letter: initial(a.label),
        pct: usagePct(a.usage),
        subtitle: a.email && a.email !== a.label ? a.email : (a.provider || ''),
      })),
    };
  }

  private _render(): void {
    if (!this._view) return;
    const nonce = crypto.randomBytes(16).toString('base64');
    this._view.webview.html = this._buildHtml(nonce);
    this._htmlInitialized = true;
  }

  private _buildHtml(nonce: string): string {
    const payload = this._getClientPayload();
    const payloadJson = JSON.stringify(payload);
    const stringsJson = JSON.stringify(this._strings);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data: https:;">
<style>
  :root {
    --bg: #1a1b26;
    --card-bg: #24283b;
    --card-border: #2f3348;
    --card-active-border: #06b6d4;
    --text: #c0caf5;
    --text-dim: #565f89;
    --text-bright: #e0e6ff;
    --accent: #06b6d4;
    --accent-hover: #22d3ee;
    --btn-bg: #2f3348;
    --btn-hover: #3b4261;
    --danger: #ef4444;
    --radius: 10px;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 0;
    overflow-x: hidden;
  }
  /* ── Header ───────────────────── */
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 14px 10px; border-bottom: 1px solid var(--card-border);
  }
  .header-left { display: flex; align-items: center; gap: 8px; }
  .header-logo {
    width: 22px; height: 22px; border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #06b6d4);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff;
  }
  .header-title { font-size: 13px; font-weight: 700; color: var(--text-bright); }
  .header-title span { font-weight: 400; color: var(--text-dim); }
  .header-summary {
    font-size: 11px; color: var(--text-dim); margin-top: 1px;
  }
  .header-summary b { color: #10b981; font-weight: 600; }
  .header-actions { display: flex; gap: 4px; }
  .header-btn {
    width: 28px; height: 28px; border-radius: 6px;
    background: var(--btn-bg); border: 1px solid var(--card-border);
    color: var(--text-dim); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; transition: all .15s;
  }
  .header-btn:hover { background: var(--btn-hover); color: var(--text); }
  .header-btn.primary {
    background: var(--accent); border-color: var(--accent);
    color: #fff; font-size: 16px; font-weight: 700;
  }
  .header-btn.primary:hover { background: var(--accent-hover); }
  .header-btn.lang {
    font-size: 10px; font-weight: 700; letter-spacing: .5px;
    text-transform: uppercase; min-width: 28px;
  }
  /* ── Section ───────────────────── */
  .section-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px 4px;
  }
  .section-label {
    font-size: 10px; text-transform: uppercase;
    letter-spacing: 1.2px; font-weight: 700; color: var(--text-dim);
  }
  .sort-btns { display: flex; gap: 3px; }
  .sort-btn {
    padding: 3px 7px; border-radius: 5px; font-size: 10px; font-weight: 600;
    background: var(--btn-bg); border: 1px solid var(--card-border);
    color: var(--text-dim); cursor: pointer; transition: all .15s;
  }
  .sort-btn:hover { background: var(--btn-hover); color: var(--text); }
  /* ── Drag & drop ───────────────── */
  .drag-handle {
    cursor: grab; color: var(--text-dim); font-size: 14px; user-select: none;
    opacity: .4; transition: opacity .15s; padding: 0 2px;
  }
  .card:hover .drag-handle { opacity: .8; }
  .card.dragging { opacity: .4; border-style: dashed; }
  .card.drag-over { border-color: var(--accent); box-shadow: 0 -2px 0 0 var(--accent); }
  /* ── Cards ───────────────────── */
  .cards { padding: 4px 10px 14px; display: flex; flex-direction: column; gap: 6px; }
  .card {
    display: flex; align-items: center; gap: 10px; padding: 10px;
    background: var(--card-bg); border: 1px solid var(--card-border);
    border-radius: var(--radius); transition: all .15s; position: relative; cursor: pointer;
  }
  .card:hover { border-color: #3b4261; }
  .card.active { border-color: var(--card-active-border); box-shadow: 0 0 0 1px var(--card-active-border); }
  .card.unsaved { border-style: dashed; cursor: default; }
  .card-num {
    font-size: 11px; color: var(--text-dim); min-width: 12px; text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .avatar {
    width: 34px; height: 34px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .card-body { flex: 1; min-width: 0; }
  .card-name-row { display: flex; align-items: center; gap: 6px; }
  .card-name {
    font-size: 13px; font-weight: 600; color: var(--text-bright);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .card-pct { font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .card-sub {
    font-size: 11px; color: var(--text-dim); margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .btn-use {
    padding: 5px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--card-border);
    background: var(--btn-bg); color: var(--text); transition: all .15s; flex-shrink: 0;
  }
  .btn-use:hover { background: var(--btn-hover); border-color: var(--accent); color: var(--accent); }
  .btn-use.btn-active { background: var(--accent); border-color: var(--accent); color: #fff; cursor: default; }
  .btn-use.btn-save { background: #6366f1; border-color: #6366f1; color: #fff; }
  .btn-use.btn-save:hover { background: #818cf8; }
  .btn-menu {
    width: 28px; height: 28px; border-radius: 6px;
    background: transparent; border: none; color: var(--text-dim); cursor: pointer;
    font-size: 16px; display: flex; align-items: center; justify-content: center;
    transition: all .15s; flex-shrink: 0;
  }
  .btn-menu:hover { background: var(--btn-bg); color: var(--text); }
  /* ── Context menu ──────────── */
  .ctx-menu {
    position: fixed; z-index: 100; background: #1e2030; border: 1px solid var(--card-border);
    border-radius: 8px; padding: 4px 0; min-width: 160px; box-shadow: 0 8px 24px rgba(0,0,0,.5);
    max-height: calc(100vh - 24px); overflow-y: auto;
  }
  .ctx-menu button {
    display: block; width: 100%; padding: 7px 14px; text-align: left; font-size: 12px;
    background: none; border: none; color: var(--text); cursor: pointer; transition: background .1s;
  }
  .ctx-menu button:hover { background: var(--btn-bg); }
  .ctx-menu button.danger { color: var(--danger); }
  .ctx-menu button.danger:hover { background: rgba(239,68,68,.1); }
  .ctx-sep { height: 1px; background: var(--card-border); margin: 4px 0; }
  /* ── Empty state ──────────── */
  .empty { text-align: center; padding: 40px 20px; }
  .empty-icon { font-size: 36px; margin-bottom: 10px; opacity: .4; }
  .empty-title { font-size: 14px; font-weight: 600; color: var(--text-dim); }
  .empty-sub { font-size: 12px; color: var(--text-dim); margin-top: 6px; }

  /* ══════════ DETAIL PANEL ══════════ */
  .detail-overlay {
    position: fixed; inset: 0; z-index: 200; background: var(--bg);
    overflow-y: auto; display: none; animation: fadeIn .2s;
  }
  .detail-overlay.show { display: block; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .detail-back {
    display: flex; align-items: center; gap: 6px; padding: 12px 14px;
    font-size: 12px; color: var(--accent); cursor: pointer; border: none; background: none;
    font-weight: 600; transition: color .15s;
  }
  .detail-back:hover { color: var(--accent-hover); }
  .detail-hero {
    text-align: center; padding: 8px 14px 16px;
    border-bottom: 1px solid var(--card-border);
  }
  .detail-avatar {
    width: 52px; height: 52px; border-radius: 50%; margin: 0 auto 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 700; color: #fff;
  }
  .detail-name { font-size: 16px; font-weight: 700; color: var(--text-bright); }
  .detail-plan {
    display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 12px;
    font-size: 11px; font-weight: 600; background: rgba(99,102,241,.15); color: #818cf8;
  }
  .detail-status {
    margin-top: 6px; font-size: 11px; color: var(--text-dim);
  }
  /* ── Gauge grid ──────────── */
  .gauge-grid {
    display: flex; flex-wrap: wrap; justify-content: center;
    gap: 16px; padding: 20px 14px;
  }
  .gauge-wrap { text-align: center; position: relative; }
  .gauge-wrap svg { display: block; margin: 0 auto; }
  .gauge-text {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -66%);
    display: flex; flex-direction: column; align-items: center;
  }
  .gauge-pct { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .gauge-label { font-size: 12px; font-weight: 700; margin-top: 6px; }
  .gauge-reset { font-size: 10px; color: var(--text-dim); margin-top: 2px; }
  /* ── Detail info rows ────── */
  .detail-info { padding: 0 14px 14px; }
  .detail-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0; border-bottom: 1px solid var(--card-border);
    font-size: 12px;
  }
  .detail-row:last-child { border-bottom: none; }
  .detail-key { color: var(--text-dim); }
  .detail-val { color: var(--text-bright); font-weight: 500; text-align: right; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .detail-actions {
    display: flex; gap: 6px; padding: 10px 14px 20px; flex-wrap: wrap;
  }
  .detail-actions button {
    flex: 1; min-width: 80px; padding: 8px 12px; border-radius: 8px;
    font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--card-border);
    background: var(--btn-bg); color: var(--text); transition: all .15s;
  }
  .detail-actions button:hover { background: var(--btn-hover); color: var(--text-bright); }
  .detail-actions button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .detail-actions button.primary:hover { background: var(--accent-hover); }
  .detail-actions button.danger { color: var(--danger); border-color: rgba(239,68,68,.3); }
  .detail-actions button.danger:hover { background: rgba(239,68,68,.1); }
</style>
</head>
<body>
  <!-- ═══ LIST VIEW ═══ -->
  <div id="listView">
    <div class="header">
      <div>
        <div class="header-left">
          <div class="header-logo">K</div>
          <div class="header-title">Kiro <span>${escHtml(this.s('wv.switcher'))}</span></div>
        </div>
        <div class="header-summary" id="headerSummary">
          <b>${payload.readyCount}</b> ${escHtml(this.s('wv.of'))} ${payload.totalCount} ${escHtml(this.s('wv.ready'))}
        </div>
      </div>
      <div class="header-actions">
        <button class="header-btn lang" title="${this._lang === 'en' ? 'Türkçe' : 'English'}" data-action="toggleLang">${this._lang === 'en' ? 'TR' : 'EN'}</button>
        <button class="header-btn" title="${escHtml(this.s('wv.refreshAll'))}" data-action="refresh">↻</button>
        <button class="header-btn" title="${escHtml(this.s('wv.import'))}" data-action="import">↓</button>
        <button class="header-btn primary" title="${escHtml(this.s('wv.saveCurrentAccount'))}" data-action="save">+</button>
      </div>
    </div>

    <div class="section-bar">
      <span class="section-label">${escHtml(this.s('wv.accounts'))}</span>
      <div class="sort-btns">
        <button class="sort-btn" data-action="sortUsageAsc" title="${escHtml(this.s('wv.sortLeast'))}">↑ %</button>
        <button class="sort-btn" data-action="sortUsageDesc" title="${escHtml(this.s('wv.sortMost'))}">↓ %</button>
        <button class="sort-btn" data-action="sortAlpha" title="${escHtml(this.s('wv.sortAZ'))}">A-Z</button>
      </div>
    </div>

    <div class="cards" id="cardsContainer"></div>
  </div>

  <!-- ═══ DETAIL VIEW ═══ -->
  <div class="detail-overlay" id="detailView">
    <button class="detail-back" id="detailBack">${escHtml(this.s('wv.back'))}</button>
    <div id="detailContent"></div>
  </div>

  <div class="ctx-menu" id="ctxMenu" style="display:none"></div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let state = ${payloadJson};
let accounts = state.accounts || [];
const i18n = ${stringsJson};
let activeDetailAccountId = null;

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtNum(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
function timeSince(ms) {
  if (!ms) return '—';
  const d = Date.now() - ms;
  const s = Math.floor(d / 1000);
  if (s < 60) return i18n['wv.justNow'] || 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function renderCards(s) {
  const container = document.getElementById('cardsContainer');
  if (!container) return;

  let html = '';

  // Unsaved card
  if (s.hasToken && !s.activeAccountId) {
    html += '<div class="card unsaved">' +
      '<div class="avatar" style="background:#6366f1">?</div>' +
      '<div class="card-body">' +
        '<div class="card-name">' + esc(s.unsavedName) + '</div>' +
        '<div class="card-sub">' + esc(i18n['wv.unsaved'] || 'Unsaved') + '</div>' +
      '</div>' +
      '<button class="btn-use btn-save" data-action="save">' + esc(i18n['wv.save'] || 'Save') + '</button>' +
    '</div>';
  }

  // Account cards
  if (s.accounts && s.accounts.length > 0) {
    for (let i = 0; i < s.accounts.length; i++) {
      const acc = s.accounts[i];
      let pctBadge = '';
      if (acc.pct !== undefined) {
        const gc = acc.pct >= 100 ? '#ef4444' : acc.pct >= 75 ? '#f59e0b' : acc.pct >= 50 ? '#06b6d4' : '#10b981';
        pctBadge = '<span class="card-pct" style="color:' + gc + '">' + acc.pct + '%</span>';
      }

      html += '<div class="card' + (acc.isActive ? ' active' : '') + '" data-id="' + esc(acc.id) + '" data-clickable="true" draggable="true" data-idx="' + i + '">' +
        '<div class="drag-handle" title="' + esc(i18n['wv.dragReorder'] || 'Drag to reorder') + '">⠿</div>' +
        '<div class="card-num">' + acc.index + '</div>' +
        '<div class="avatar" style="background:' + acc.color + '">' + acc.letter + '</div>' +
        '<div class="card-body">' +
          '<div class="card-name-row">' +
            '<span class="card-name">' + esc(acc.label) + '</span>' +
            pctBadge +
          '</div>' +
          '<div class="card-sub">' + esc(acc.subtitle) + '</div>' +
        '</div>' +
        '<button class="btn-use' + (acc.isActive ? ' btn-active' : '') + '" data-action="switch" data-id="' + esc(acc.id) + '">' + (acc.isActive ? esc(i18n['wv.active'] || 'Active') : esc(i18n['wv.use'] || 'Use')) + '</button>' +
        '<button class="btn-menu" data-action="menu" data-id="' + esc(acc.id) + '">⋯</button>' +
      '</div>';
    }
  } else if (!s.hasToken) {
    html += '<div class="empty">' +
      '<div class="empty-icon">👤</div>' +
      '<div class="empty-title">' + esc(i18n['wv.noAccounts'] || 'No accounts saved') + '</div>' +
      '<div class="empty-sub">' + esc(i18n['wv.noAccountsSub'] || 'Sign in to Kiro, then click + to save') + '</div>' +
    '</div>';
  }

  container.innerHTML = html;
}

function updateHeader(s) {
  const sumEl = document.getElementById('headerSummary');
  if (sumEl) {
    sumEl.innerHTML = '<b>' + s.readyCount + '</b> ' + esc(i18n['wv.of'] || 'of') + ' ' + s.totalCount + ' ' + esc(i18n['wv.ready'] || 'ready');
  }
}

// Initial render of cards
renderCards(state);

// Incremental message listener
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'stateUpdate' && msg.payload) {
    state = msg.payload;
    accounts = state.accounts || [];
    updateHeader(state);
    renderCards(state);

    // If detail view is open, smoothly update its contents without closing
    const detailView = document.getElementById('detailView');
    if (detailView && detailView.classList.contains('show') && activeDetailAccountId) {
      const updated = accounts.find(a => a.id === activeDetailAccountId);
      if (updated) {
        populateDetail(updated);
      } else {
        closeDetail();
      }
    }
  }
});

// ── List view click handling ──
document.addEventListener('click', (e) => {
  const ctxMenu = document.getElementById('ctxMenu');
  if (ctxMenu && !ctxMenu.contains(e.target)) ctxMenu.style.display = 'none';

  const btn = e.target.closest('[data-action]');
  if (btn) {
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'menu') { e.stopPropagation(); showContextMenu(e, id, btn); return; }
    if (action === 'back') { closeDetail(); return; }
    vscode.postMessage({ command: action, id });
    return;
  }

  // Card click → open detail
  const card = e.target.closest('.card[data-clickable]');
  if (card) {
    const id = card.dataset.id;
    const acc = accounts.find(a => a.id === id);
    if (acc) openDetail(acc);
  }
});

// ── Detail panel ──
function populateDetail(acc) {
  activeDetailAccountId = acc.id;
  const pct = (acc.used !== undefined && acc.limit > 0)
    ? Math.min(100, Math.round((acc.used / acc.limit) * 100)) : null;

  const resetMs = acc.resetDate ? new Date(acc.resetDate).getTime() - Date.now() : 0;
  let resetStr = '';
  if (resetMs > 0) {
    const h = Math.floor(resetMs / 3600000);
    if (h < 24) resetStr = h + 'h';
    else { const d = Math.floor(h / 24); resetStr = d + 'd ' + (h % 24) + 'h'; }
  }

  let gaugeHtml = '';
  if (pct !== null) {
    gaugeHtml = buildGauge(pct, acc.unit || 'Credits', 100, resetStr);
  } else {
    gaugeHtml = '<div style="text-align:center;padding:20px;color:#565f89;font-size:12px">' + esc(i18n['wv.noUsageData'] || 'No usage data') + '</div>';
  }

  const usedStr = acc.used !== undefined ? fmtNum(acc.used) : '—';
  const limitStr = acc.limit !== undefined ? fmtNum(acc.limit) : '—';
  const remaining = (acc.limit !== undefined && acc.used !== undefined) ? fmtNum(Math.max(0, acc.limit - acc.used)) : '—';

  const created = acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : '—';
  const lastUsed = acc.lastUsedAt ? timeSince(acc.lastUsedAt) : '—';

  document.getElementById('detailContent').innerHTML =
    '<div class="detail-hero">' +
      '<div class="detail-avatar" style="background:' + acc.color + '">' + acc.letter + '</div>' +
      '<div class="detail-name">' + esc(acc.label) + '</div>' +
      (acc.planName ? '<div class="detail-plan">' + esc(acc.planName) + '</div>' : '') +
      '<div class="detail-status">' + (acc.isActive ? '● ' + esc(i18n['wv.active'] || 'Active') : '○ ' + esc(i18n['wv.inactive'] || 'Inactive')) + (acc.email ? ' · ' + esc(acc.email) : '') + '</div>' +
    '</div>' +
    '<div class="gauge-grid">' + gaugeHtml + '</div>' +
    '<div class="detail-info">' +
      '<div class="detail-row"><span class="detail-key">' + esc(i18n['wv.used'] || 'Used') + '</span><span class="detail-val">' + usedStr + ' / ' + limitStr + '</span></div>' +
      '<div class="detail-row"><span class="detail-key">' + esc(i18n['wv.remaining'] || 'Remaining') + '</span><span class="detail-val">' + remaining + '</span></div>' +
      '<div class="detail-row"><span class="detail-key">' + esc(i18n['wv.reset'] || 'Reset') + '</span><span class="detail-val">' + (resetStr || '—') + '</span></div>' +
      '<div class="detail-row"><span class="detail-key">' + esc(i18n['wv.provider'] || 'Provider') + '</span><span class="detail-val">' + esc(acc.provider || '—') + '</span></div>' +
      '<div class="detail-row"><span class="detail-key">' + esc(i18n['wv.lastUsed'] || 'Last used') + '</span><span class="detail-val">' + lastUsed + '</span></div>' +
      '<div class="detail-row"><span class="detail-key">' + esc(i18n['wv.savedOn'] || 'Saved') + '</span><span class="detail-val">' + created + '</span></div>' +
      (acc.userId ? '<div class="detail-row"><span class="detail-key">User ID</span><span class="detail-val" title="' + esc(acc.userId) + '">' + esc(acc.userId.slice(0, 20)) + '…</span></div>' : '') +
    '</div>' +
    '<div class="detail-actions">' +
      '<button class="primary" data-action="switch" data-id="' + acc.id + '">' + (acc.isActive ? esc(i18n['wv.active'] || 'Active') : esc(i18n['wv.use'] || 'Use')) + '</button>' +
      '<button data-action="refreshOne" data-id="' + acc.id + '">' + esc(i18n['wv.refresh'] || 'Refresh') + '</button>' +
      '<button data-action="rename" data-id="' + acc.id + '">' + esc(i18n['wv.rename'] || 'Rename') + '</button>' +
      '<button class="danger" data-action="delete" data-id="' + acc.id + '">' + esc(i18n['wv.ctxDelete'] || 'Delete') + '</button>' +
    '</div>';
}

function openDetail(acc) {
  populateDetail(acc);
  document.getElementById('detailView').classList.add('show');
}

function closeDetail() {
  activeDetailAccountId = null;
  document.getElementById('detailView').classList.remove('show');
}

document.getElementById('detailBack').addEventListener('click', closeDetail);

// ── SVG gauge builder (client-side) ──
function buildGauge(pct, label, size, resetStr) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 100 ? '#ef4444' : pct >= 75 ? '#f59e0b' : pct >= 50 ? '#06b6d4' : '#10b981';
  const cx = size / 2, cy = size / 2;
  return '<div class="gauge-wrap">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#2f3348" stroke-width="5"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="5"' +
        ' stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"' +
        ' stroke-linecap="round" transform="rotate(-90 ' + cx + ' ' + cy + ')"' +
        ' style="transition: stroke-dashoffset .6s ease"/>' +
    '</svg>' +
    '<div class="gauge-text"><span class="gauge-pct" style="color:' + color + '">' + pct + '%</span></div>' +
    '<div class="gauge-label" style="color:' + color + '">' + esc(label) + '</div>' +
    (resetStr ? '<div class="gauge-reset">↻ ' + esc(resetStr) + '</div>' : '') +
  '</div>';
}

// ── Drag & drop reorder ──
let dragSrcId = null;
const cardsContainer = document.getElementById('cardsContainer');

cardsContainer.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card[draggable]');
  if (!card) return;
  dragSrcId = card.dataset.id;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', card.dataset.id);
});

cardsContainer.addEventListener('dragend', (e) => {
  const card = e.target.closest('.card');
  if (card) card.classList.remove('dragging');
  document.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
  dragSrcId = null;
});

cardsContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.target.closest('.card[draggable]');
  if (!card || card.dataset.id === dragSrcId) return;
  document.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
  card.classList.add('drag-over');
});

cardsContainer.addEventListener('dragleave', (e) => {
  const card = e.target.closest('.card');
  if (card) card.classList.remove('drag-over');
});

cardsContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  document.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
  const targetCard = e.target.closest('.card[draggable]');
  if (!targetCard || !dragSrcId || targetCard.dataset.id === dragSrcId) return;
  vscode.postMessage({ command: 'reorder', id: dragSrcId, targetId: targetCard.dataset.id });
});

// ── Context menu ──
function showContextMenu(e, id, trigger) {
  const menu = document.getElementById('ctxMenu');
  menu.innerHTML =
    '<button data-action="switch" data-id="' + id + '">' + esc(i18n['wv.ctxSwitch'] || 'Switch to this account') + '</button>' +
    '<button data-action="refreshOne" data-id="' + id + '">' + esc(i18n['wv.ctxRefresh'] || 'Refresh quota') + '</button>' +
    '<div class="ctx-sep"></div>' +
    '<button data-action="rename" data-id="' + id + '">' + esc(i18n['wv.ctxRename'] || 'Rename') + '</button>' +
    '<button data-action="copyUserId" data-id="' + id + '">' + esc(i18n['wv.ctxCopyId'] || 'Copy User ID') + '</button>' +
    '<button data-action="moveUp" data-id="' + id + '">' + esc(i18n['wv.ctxMoveUp'] || 'Move up') + '</button>' +
    '<button data-action="moveDown" data-id="' + id + '">' + esc(i18n['wv.ctxMoveDown'] || 'Move down') + '</button>' +
    '<div class="ctx-sep"></div>' +
    '<button data-action="signOut">' + esc(i18n['wv.ctxSignOut'] || 'Sign out & add new') + '</button>' +
    '<button class="danger" data-action="delete" data-id="' + id + '">' + esc(i18n['wv.ctxDelete'] || 'Delete account') + '</button>';
  menu.style.display = 'block';
  const rect = trigger.getBoundingClientRect();
  const menuHeight = menu.offsetHeight || 260;
  const menuWidth = menu.offsetWidth || 180;

  // Vertical: if overflowing below, flip upwards above trigger button
  if (rect.bottom + menuHeight > window.innerHeight && rect.top - menuHeight > 8) {
    menu.style.top = (rect.top - menuHeight - 4) + 'px';
  } else if (rect.bottom + menuHeight > window.innerHeight) {
    menu.style.top = Math.max(8, window.innerHeight - menuHeight - 8) + 'px';
  } else {
    menu.style.top = (rect.bottom + 4) + 'px';
  }

  // Horizontal: align right edge with trigger button, keep within viewport
  const idealLeft = rect.right - menuWidth;
  menu.style.left = Math.max(8, Math.min(idealLeft, window.innerWidth - menuWidth - 8)) + 'px';
}

// Signal to extension that webview is mounted and listening
vscode.postMessage({ command: 'ready' });
</script>
</body>
</html>`;
  }
}
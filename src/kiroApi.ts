import { KiroAuthToken, UsageSummary } from './types';

const SOCIAL_REFRESH_URL = 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken';
const SOCIAL_PROVIDERS = new Set(['Google', 'Github']);

export function extractRegion(token: KiroAuthToken): string {
  if (typeof token.profileArn === 'string' && token.profileArn.startsWith('arn:')) {
    const parts = token.profileArn.split(':');
    if (parts.length >= 4 && parts[3]) {
      return parts[3];
    }
  }
  if (typeof token.region === 'string' && token.region.trim()) {
    return token.region.trim();
  }
  return 'us-east-1';
}

export function isSocialToken(token: KiroAuthToken): boolean {
  if (token.authMethod === 'social') {
    return true;
  }
  return typeof token.provider === 'string' && SOCIAL_PROVIDERS.has(token.provider);
}

export function isTokenExpired(token: KiroAuthToken, bufferMs = 60_000): boolean {
  if (!token.expiresAt) {
    return false;
  }
  const expiresMs = Date.parse(token.expiresAt);
  if (!Number.isFinite(expiresMs)) {
    return true;
  }
  return expiresMs <= Date.now() + bufferMs;
}

export async function refreshSocialToken(token: KiroAuthToken): Promise<KiroAuthToken> {
  if (!isSocialToken(token) || !token.refreshToken) {
    return token;
  }

  const res = await fetch(SOCIAL_REFRESH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'kiro-account-switcher/1.0.0',
    },
    body: JSON.stringify({ refreshToken: token.refreshToken }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Token refresh failed (${res.status}): ${errText || res.statusText}`);
  }

  const data = (await res.json()) as {
    accessToken?: string;
    refreshToken?: string;
    profileArn?: string;
    expiresIn?: number;
  };

  if (!data.accessToken) {
    throw new Error('Token refresh response did not include accessToken');
  }

  const expiresInSec = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : 3600;
  return {
    ...token,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || token.refreshToken,
    profileArn: data.profileArn || token.profileArn,
    expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
  };
}

interface RawUsageBreakdown {
  displayName?: string;
  resourceType?: string;
  currentUsage?: number;
  currentUsageWithPrecision?: number;
  usageLimit?: number;
  usageLimitWithPrecision?: number;
  unit?: string;
  freeTrialInfo?: {
    currentUsage?: number;
    currentUsageWithPrecision?: number;
    usageLimit?: number;
    usageLimitWithPrecision?: number;
    freeTrialStatus?: string;
  };
}

interface RawGetUsageLimitsResponse {
  userInfo?: {
    userId?: string;
    email?: string;
  };
  subscriptionInfo?: {
    subscriptionTitle?: string;
    subscriptionName?: string;
    type?: string;
  };
  nextDateReset?: number | string;
  usageBreakdownList?: RawUsageBreakdown[];
}

export async function fetchUsageLimits(token: KiroAuthToken): Promise<UsageSummary> {
  const region = extractRegion(token);
  const url = new URL(`https://management.${region}.kiro.dev/Get-Usage-Limits`);
  url.searchParams.set('origin', 'AI_EDITOR');
  url.searchParams.set('isEmailRequired', 'true');
  if (token.profileArn) {
    url.searchParams.set('profileArn', token.profileArn);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'kiro-account-switcher/1.0.0',
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Get-Usage-Limits failed (${res.status}): ${errText || res.statusText}`);
  }

  const data = (await res.json()) as RawGetUsageLimitsResponse;
  const breakdowns = Array.isArray(data.usageBreakdownList)
    ? data.usageBreakdownList.filter((b) => b.resourceType !== 'AGENTIC_REQUEST')
    : [];

  const primary =
    breakdowns.find((b) => (b.usageLimitWithPrecision ?? b.usageLimit ?? 0) > 0) ||
    breakdowns[0];

  let used: number | undefined;
  let limit: number | undefined;

  if (primary) {
    const baseUsed = primary.currentUsageWithPrecision ?? primary.currentUsage ?? 0;
    const baseLimit = primary.usageLimitWithPrecision ?? primary.usageLimit ?? 0;

    if (primary.freeTrialInfo?.freeTrialStatus === 'ACTIVE') {
      const trialUsed =
        primary.freeTrialInfo.currentUsageWithPrecision ??
        primary.freeTrialInfo.currentUsage ??
        0;
      const trialLimit =
        primary.freeTrialInfo.usageLimitWithPrecision ??
        primary.freeTrialInfo.usageLimit ??
        0;
      used = baseUsed + trialUsed;
      limit = baseLimit + trialLimit;
    } else {
      used = baseUsed;
      limit = baseLimit;
    }
  }

  let resetDate: string | undefined;
  if (typeof data.nextDateReset === 'number' && data.nextDateReset > 0) {
    const ms = data.nextDateReset < 1e12 ? data.nextDateReset * 1000 : data.nextDateReset;
    resetDate = new Date(ms).toISOString();
  } else if (typeof data.nextDateReset === 'string' && data.nextDateReset) {
    resetDate = data.nextDateReset;
  }

  const planName =
    data.subscriptionInfo?.subscriptionTitle ||
    data.subscriptionInfo?.subscriptionName ||
    data.subscriptionInfo?.type;

  return {
    email: data.userInfo?.email,
    userId: data.userInfo?.userId,
    planName,
    used,
    limit,
    unit: primary?.unit,
    breakdownTitle: primary?.displayName,
    resetDate,
    fetchedAt: Date.now(),
  };
}

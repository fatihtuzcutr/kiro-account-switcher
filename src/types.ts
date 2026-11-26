export interface KiroAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  provider?: string;
  authMethod?: string;
  profileArn?: string;
  region?: string;
  [key: string]: unknown;
}

export interface KiroConnection {
  authMethod: string;
  provider: string;
  startUrl?: string;
  region?: string;
  [key: string]: unknown;
}

export interface KiroProfile {
  arn: string;
  name: string;
}

export interface UsageSummary {
  email?: string;
  userId?: string;
  planName?: string;
  used?: number;
  limit?: number;
  unit?: string;
  breakdownTitle?: string;
  resetDate?: string;
  fetchedAt: number;
}

export interface SavedAccountMetadata {
  id: string;
  label: string;
  email?: string;
  userId?: string;
  provider?: string;
  authMethod?: string;
  profileArn?: string;
  usage?: UsageSummary;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface AccountSecretBundle {
  token: KiroAuthToken;
  connection?: KiroConnection;
  profile?: KiroProfile;
}

export interface ActiveDiskState {
  token?: KiroAuthToken;
  connection?: KiroConnection;
  profile?: KiroProfile;
  sourceFile?: string;
}

/**
 * KATA Architecture - API Auth Setup (Project)
 *
 * Signs each test identity (owner, member, viewer, non-member) in ONCE per
 * run via the AuthApi.authenticateSuccessfully() ATC and caches its PAT +
 * session cookies in `.auth/identities/<role>.json`. Tests switch actor with
 * `useIdentity` (`@utils/auth`) without another sign-in, which keeps the
 * suite under the BK-1828 sign-in throttle (ADR-0029).
 *
 * The owner identity is also mirrored to `.auth/api-state.json`, the file the
 * `api` fixture reads (also written by `scripts/api-login.ts`). Every cached
 * identity file is removed first, so a failed setup never leaves a previous
 * run's cache behind. Setup PATs are minted with a 1-day lifetime.
 *
 * A secondary role without credentials for the current TEST_ENV is cached as
 * unprovisioned and its specs skip (`isIdentityProvisioned`). Any role WITH
 * credentials whose sign-in fails fails this setup, exactly like the owner,
 * and so does a role with only one of email / password set.
 *
 * Dependencies: global-setup
 * Dependents: integration, smoke-api
 */

import type { ApiState, IdentityRole, IdentityState } from '@data/types';

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ApiFixture } from '@ApiFixture';
import { test as setup } from '@TestFixture';
import { config } from '@variables';

const identities: Array<{ role: IdentityRole, credentials: { email: string, password: string } }> = [
  { role: 'owner', credentials: config.testUser },
  { role: 'member', credentials: config.testMember },
  { role: 'viewer', credentials: config.testViewer },
  { role: 'nonMember', credentials: config.testNonMember },
];

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function writeUnprovisioned(role: IdentityRole, reason: string): void {
  const state: IdentityState = { provisioned: false, role, reason, apiUrl: config.apiUrl, createdAt: new Date().toISOString() };
  writeJson(config.auth.identityStatePath(role), state);
  console.warn(`[API Setup] ${role}: not provisioned (${reason})`);
}

setup('API Setup: authenticate via API', async ({ playwright }) => {
  console.log(`[API Setup] Target: ${config.apiUrl}${config.auth.loginEndpoint}`);

  for (const { role } of identities) {
    rmSync(config.auth.identityStatePath(role), { force: true });
  }

  for (const { role, credentials } of identities) {
    const hasEmail = Boolean(credentials.email);
    const hasPassword = Boolean(credentials.password);
    if (!hasEmail || !hasPassword) {
      if (role === 'owner') { throw new Error('[API Setup] Owner credentials are not set for the current TEST_ENV'); }
      if (hasEmail !== hasPassword) {
        const state = hasEmail ? 'email set, password missing' : 'password set, email missing';
        throw new Error(`[API Setup] ${role}: credentials half-configured (${state})`);
      }
      writeUnprovisioned(role, 'no credentials for the current TEST_ENV');
      continue;
    }

    // Fresh context per identity: cookie jars never mix between roles.
    const request = await playwright.request.newContext({
      baseURL: config.baseUrl,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en' },
      storageState: { cookies: [], origins: [] },
    });

    try {
      const api = new ApiFixture({ request });
      // Short-lived PAT: the cache only needs to outlive one run.
      const [, tokenData] = await api.auth.authenticateSuccessfully({ ...credentials, pat_expires_in_days: 1 });

      const nowSeconds = Math.floor(Date.now() / 1000);
      const apiState: ApiState = {
        token: tokenData.pat.token,
        tokenType: tokenData.session.token_type ?? 'bearer',
        expiresIn: tokenData.session.expires_at ? tokenData.session.expires_at - nowSeconds : config.auth.tokenLifetimeSeconds,
        refreshToken: tokenData.session.refresh_token,
        source: 'api-login',
        createdAt: new Date().toISOString(),
      };
      const { cookies } = await request.storageState();
      // Absolute expiry from the session itself; conservative 1 h when absent.
      const sessionExpiresAt = tokenData.session.expires_at
        ? new Date(tokenData.session.expires_at * 1000).toISOString()
        : new Date(Date.parse(apiState.createdAt) + 3600 * 1000).toISOString();
      const state: IdentityState = { ...apiState, provisioned: true, role, apiUrl: config.apiUrl, sessionExpiresAt, cookies };

      writeJson(config.auth.identityStatePath(role), state);
      if (role === 'owner') { writeJson(config.auth.apiStatePath, apiState); }

      console.log(`[API Setup] ${role}: signed in (PAT scopes: ${tokenData.pat.scopes.join(', ')}, ${cookies.length} cookies)`);
    }
    finally {
      await request.dispose();
    }
  }
});

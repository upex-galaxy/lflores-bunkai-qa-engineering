/**
 * KATA Architecture - Shared Allure Utilities
 *
 * Provides common Allure attachment helpers used across the framework.
 * Centralizes Allure functionality to avoid duplication (DRY principle).
 *
 * Used by:
 * - ApiBase (Layer 2) for API request/response attachments
 * - Interception utilities for captured request/response attachments
 * - Any component needing to attach data to Allure reports
 */

import * as allure from 'allure-js-commons';
import { ContentType } from 'allure-js-commons';

// ============================================
// Types
// ============================================

export interface AllureFilenameArgs {
  /** URL or endpoint path (query params will be stripped) */
  url: string
  /** Suffix to append (e.g., 'GET_response', 'POST_request') */
  suffix: string
}

export interface AttachJsonArgs {
  /** Display name for the attachment in Allure report */
  name: string
  /** JSON-serializable data to attach */
  data: unknown
  /** Content type (defaults to JSON) */
  contentType?: ContentType
}

export interface AttachRequestResponseArgs {
  /** URL or endpoint for filename generation */
  url: string
  /** HTTP method (GET, POST, etc.) */
  method: string
  /** Response body to attach (optional) */
  responseBody?: unknown
  /** Request payload to attach (optional) */
  requestBody?: unknown
}

// ============================================
// Filename Generation
// ============================================

/**
 * Generate a clean filename for Allure attachments from URL/endpoint.
 *
 * Handles both full URLs and endpoint paths:
 * - Full URL: "https://api.example.com/auth/login?foo=bar" → "auth_login_POST_response"
 * - Endpoint: "/api/users/123" → "_api_users_123_GET_response"
 *
 * @example
 * const filename = generateAllureFilename({
 *   url: 'https://api.example.com/auth/login',
 *   suffix: 'POST_response'
 * });
 * // Returns: "auth_login_POST_response"
 */
export function generateAllureFilename(args: AllureFilenameArgs): string {
  const { url, suffix } = args;

  // Remove query params and protocol
  const cleanUrl = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '');

  // Take last 2 path segments for meaningful name
  const segments = cleanUrl.split('/').filter(Boolean).slice(-2);
  const pathPart = segments.length > 0 ? segments.join('_') : 'root';

  // Clean non-alphanumeric chars and limit length
  const cleanPath = pathPart.replace(/[^a-z0-9]/gi, '_').slice(0, 50);

  return `${cleanPath}_${suffix}`;
}

// ============================================
// Redaction
// ============================================

/** Normalise an object key for secret matching: lower-cased, `_` and `-` removed */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

/**
 * Object keys whose values never reach an Allure attachment or a step title.
 * Stored normalised (`normalizeKey`), so `access_token`, `accessToken` and
 * `Access-Token` all match.
 */
const SECRET_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'session_token',
  'authorization',
  'cookie',
  'cookies',
  'set-cookie',
  'secret',
  'api_key',
  'apikey',
  'x-api-key',
  'id_token',
  'jwt',
].map(normalizeKey));

const REDACTED = '***';
const PAT_PATTERN = /bk_pat_[\w.-]+/g;
const TOKEN_QUERY_PARAM_PATTERN = /([?&](?:token|access_token|refresh_token)=)[^&#\s"]+/gi;
const JWT_PATTERN = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER_PATTERN = /(Bearer\s+)[^\s"',]+/gi;
const SUPABASE_COOKIE_PATTERN = /base64-[\w+/=-]{20,}/g;

/** True when `key` names a secret (case-, `_`- and `-`-insensitive) */
export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(normalizeKey(key));
}

/**
 * Mask secrets embedded in a string: every PAT (`bk_pat_...` becomes
 * `bk_pat_***`), the value of every `token`, `access_token` or
 * `refresh_token` URL query parameter, every JWT, every `Bearer <value>` and
 * every Supabase cookie value (`base64-...`). Other text is returned
 * unchanged. Idempotent.
 */
export function redactSecretString(value: string): string {
  return value
    .replace(PAT_PATTERN, `bk_pat_${REDACTED}`)
    .replace(TOKEN_QUERY_PARAM_PATTERN, `$1${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, `$1${REDACTED}`)
    .replace(SUPABASE_COOKIE_PATTERN, `base64-${REDACTED}`);
}

/** True for `{}` literals and `Object.create(null)` objects, false for class instances */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Return a deep copy of `value` with secrets masked, at any depth (plain
 * objects and arrays): the value of every secret key (`isSecretKey`) becomes
 * `'***'` and every string goes through `redactSecretString`. Other non-string
 * values (Date, Buffer, class instances) are returned unchanged; a cycle
 * becomes `'[Circular]'`. Idempotent; the input is never mutated.
 */
export function redactSecrets<T>(value: T): T {
  return redactValue(value, new WeakSet<object>()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return redactSecretString(value);
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  let copy: unknown;
  if (Array.isArray(value)) {
    copy = value.map(item => redactValue(item, seen));
  }
  else {
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      record[key] = isSecretKey(key) ? REDACTED : redactValue(item, seen);
    }
    copy = record;
  }
  seen.delete(value);
  return copy;
}

// ============================================
// Attachment Functions
// ============================================

/**
 * Attach JSON data to Allure report with error handling.
 *
 * Silently fails if Allure is not available (e.g., in setup projects).
 * Secrets are redacted first (`redactSecrets`): object data by key and string
 * rules, raw-text data by the string rules (`redactSecretString`), because the
 * Allure report is published publicly.
 *
 * @example
 * await attachJsonToAllure({
 *   name: 'API Response',
 *   data: { id: 1, name: 'Test' }
 * });
 */
export async function attachJsonToAllure(args: AttachJsonArgs): Promise<void> {
  const { name, contentType = ContentType.JSON } = args;

  try {
    const data = redactSecrets(args.data);
    if (data === undefined || data === null) {
      return;
    }

    // Check if data is an object with content
    if (typeof data === 'object' && Object.keys(data).length === 0) {
      return;
    }

    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await allure.attachment(name, content, contentType);
  }
  catch {
    // Allure might not be available in all contexts
  }
}

/**
 * Attach HTTP request and response bodies to Allure report.
 *
 * Generates appropriate filenames and attaches both request and response
 * if they contain data. Both bodies are deep-cloned and redacted first
 * (`redactSecrets`): passwords, tokens, cookies and PATs become `'***'`,
 * because the Allure report is published publicly.
 *
 * @example
 * await attachRequestResponseToAllure({
 *   url: '/api/auth/login',
 *   method: 'POST',
 *   requestBody: { email: 'test@example.com', password: '***' },
 *   responseBody: { access_token: '...' }
 * });
 */
export async function attachRequestResponseToAllure(
  args: AttachRequestResponseArgs,
): Promise<void> {
  const { url, method } = args;

  try {
    const responseBody = redactSecrets(args.responseBody);
    const requestBody = redactSecrets(args.requestBody);

    // Attach response body if exists
    if (responseBody !== undefined && responseBody !== null) {
      const isNonEmpty = typeof responseBody !== 'object' || Object.keys(responseBody).length > 0;
      if (isNonEmpty) {
        const filename = generateAllureFilename({ url, suffix: `${method}_response` });
        await attachJsonToAllure({ name: filename, data: responseBody });
      }
    }

    // Attach request body if exists
    if (requestBody !== undefined && requestBody !== null) {
      const isNonEmpty = typeof requestBody !== 'object' || Object.keys(requestBody).length > 0;
      if (isNonEmpty) {
        const filename = generateAllureFilename({ url, suffix: `${method}_request` });
        await attachJsonToAllure({ name: filename, data: requestBody });
      }
    }
  }
  catch {
    // Allure might not be available in all contexts
  }
}

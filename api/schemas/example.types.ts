/**
 * KATA Framework - Type Facade: Example Domain
 *
 * REFERENCE COMPONENT — wired to the real `/api/v1/tests` endpoints so it
 * type-checks and runs against this project's actual backend. Kept under the
 * "Example" name as the structural guide for the Type Facade Pattern; copy
 * this file to api/schemas/{domain}.types.ts to start a new domain facade.
 *
 * Sections:
 * 1. Schema Types — domain models from components['schemas']
 * 2. Endpoint Types — request/response types from paths[...], grouped by endpoint
 * 3. Custom Types — types NOT in the spec (error shapes, test helpers, etc.)
 */

import type { components, paths } from '@openapi';

// ============================================================================
// Schema Types (from components.schemas)
// ============================================================================

export type ExampleModel = components['schemas']['Test'];

export type ExampleListModel = components['schemas']['ExpandedTest'];

// ============================================================================
// Endpoint Types - POST /api/v1/tests
// ============================================================================

/** Private helper: extracts the POST operation type for cleaner access */
type CreateExamplePath = paths['/api/v1/tests']['post'];

/** Request body for creating a test */
export type CreateExampleRequest = CreateExamplePath['requestBody']['content']['application/json'];

/** Successful response (201) */
export type CreateExampleResponse = CreateExamplePath['responses']['201']['content']['application/json'];

// ============================================================================
// Endpoint Types - GET /api/v1/tests/{id}
// ============================================================================

type GetExamplePath = paths['/api/v1/tests/{id}']['get'];

/** Path parameters (e.g., { id: string }) */
export type GetExampleParams = GetExamplePath['parameters']['path'];

/** Successful response (200) */
export type GetExampleResponse = GetExamplePath['responses']['200']['content']['application/json'];

// ============================================================================
// Custom Types (not in OpenAPI spec)
// ============================================================================

/**
 * Types that are NOT in the OpenAPI spec go here.
 * Common cases: error response shapes not documented, test helpers,
 * or types for endpoints that lack schema definitions.
 */
export interface ExampleErrorResponse {
  error: string
  message?: string
  statusCode?: number
}

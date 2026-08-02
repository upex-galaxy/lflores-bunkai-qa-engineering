/**
 * KATA Architecture - Layer 3: Example API Component
 *
 * REFERENCE COMPONENT — wired to the real `POST /api/v1/tests` and
 * `GET /api/v1/tests/{id}` endpoints so it type-checks and runs against
 * this project's actual backend. Kept under the "Example" name as the
 * structural guide for API components; copy this file to
 * tests/components/api/YourApi.ts to start a new domain component.
 *
 * To create your own component:
 * 1. Copy this file to tests/components/api/YourApi.ts
 * 2. Point it at your own endpoints
 * 3. Update types to match your API's request/response schemas
 * 4. Register in ApiFixture.ts
 * 5. Run: bun run kata:manifest
 *
 * KATA Principles Demonstrated:
 * - ATCs are COMPLETE test cases (mini-flows), NOT single API calls
 * - Each ATC has a UNIQUE expected output (Equivalence Partitioning)
 * - Tuple returns: [APIResponse, TBody, TPayload] for type-safe access
 * - Fixed assertions validate the ATC succeeded
 */

import type { APIResponse } from '@playwright/test';
import type { CreateExampleRequest, CreateExampleResponse, GetExampleResponse } from '@schemas/example.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// Re-export types for consumers that import from ExampleApi
export type { CreateExampleRequest, CreateExampleResponse, GetExampleResponse } from '@schemas/example.types';

// ============================================
// Example API Component
// ============================================

export class ExampleApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: POST /api/v1/tests with a valid payload - expects success (201)
   *
   * Complete flow: POST data with a fresh Idempotency-Key, validate response structure.
   * Returns the response tuple for test assertions.
   *
   * TODO: Replace 'PROJ' with your Jira project key (e.g., @atc('UPEX-101'))
   */
  @atc('PROJ-101')
  async createResourceSuccessfully(
    payload: CreateExampleRequest,
  ): Promise<[APIResponse, CreateExampleResponse, CreateExampleRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<CreateExampleResponse, CreateExampleRequest>(
      '/api/v1/tests',
      payload,
      { headers: { 'Idempotency-Key': crypto.randomUUID() } },
    );

    // Fixed assertions - validates the operation succeeded
    expect(response.status()).toBe(201);
    expect(body.test).toBeDefined();
    expect(body.test.id).toBeDefined();

    return [response, body, sentPayload];
  }

  /**
   * ATC: POST /api/v1/tests with invalid payload - expects error (400)
   *
   * Validates that an empty `atc_ids` chain (server requires >= 1) returns
   * a `bad_request` error, not a 201.
   *
   * TODO: Replace 'PROJ' with your Jira project key (e.g., @atc('UPEX-102'))
   */
  @atc('PROJ-102')
  async createResourceWithInvalidData(
    payload: CreateExampleRequest,
  ): Promise<[APIResponse, Record<string, unknown>, CreateExampleRequest]> {
    const [response, body, sentPayload] = await this.apiPOST<
      Record<string, unknown>,
      CreateExampleRequest
    >('/api/v1/tests', payload, { headers: { 'Idempotency-Key': crypto.randomUUID() } });

    // Fixed assertions - validates error response
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.ok()).toBe(false);

    return [response, body, sentPayload];
  }

  /**
   * ATC: GET /api/v1/tests/{id} - expects success (200)
   *
   * Example of a GET ATC for fetching resources.
   *
   * TODO: Replace 'PROJ' with your Jira project key (e.g., @atc('UPEX-103'))
   */
  @atc('PROJ-103')
  async getResourceSuccessfully(resourceId: string): Promise<[APIResponse, GetExampleResponse]> {
    const [response, body] = await this.apiGET<GetExampleResponse>(`/api/v1/tests/${resourceId}`);

    // Fixed assertions
    expect(response.status()).toBe(200);
    expect(body.test).toBeDefined();

    return [response, body];
  }
}

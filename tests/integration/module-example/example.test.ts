/**
 * KATA Architecture - Example Integration Test
 *
 * REFERENCE TEST — wired to the real `POST /api/v1/tests` endpoint via
 * ExampleApi, so it runs against this project's actual backend.
 *
 * To create your own functional tests:
 * 1. Copy this file to tests/integration/[feature].test.ts
 * 2. Point the ATCs in your API components at your own endpoints
 * 3. Configure real API URLs in config/variables.ts
 *
 * Key Pattern:
 * - ATCs are complete test cases with fixed assertions
 * - Test file orchestrates ATCs for API testing
 * - No browser needed - uses API fixture directly
 */

import { expect, test } from '@TestFixture';

test.describe('PROJ-100: Example API', () => {
  /**
   * Tests successful resource creation.
   * ATC: PROJ-101
   */
  test('PROJ-100: should create resource successfully', { tag: ['@critical'] }, async ({ api }) => {
    // ARRANGE - Prepare test data using DataFactory (available via api.data)
    const payload = api.data.createTestCase();

    // ACT & ASSERT - ATC handles the complete flow
    const [_response, body, sentPayload] = await api.example.createResourceSuccessfully(payload);

    // Additional test-level assertions (optional)
    expect(body.test.title).toBe(sentPayload.title);
  });

  /**
   * Tests error handling for invalid data.
   * ATC: PROJ-102
   */
  test('PROJ-100: should return error for invalid data', async ({ api }) => {
    // ARRANGE - Invalid payload: empty atc_ids chain (server requires >= 1)
    const invalidPayload = { title: 'Invalid test case', atc_ids: [] };

    // ACT & ASSERT - ATC validates error response
    await api.example.createResourceWithInvalidData(invalidPayload);
  });
});

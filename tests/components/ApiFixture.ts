/**
 * KATA Architecture - Layer 4: API Fixture
 *
 * Dependency Injection container for all API components.
 * Provides unified access to API testing capabilities.
 *
 * All API components share the same request context from TestContext,
 * ensuring consistent authentication and request configuration.
 *
 * HOW TO ADD NEW API COMPONENTS:
 * 1. Create your component in tests/components/api/YourApi.ts
 * 2. Import it here
 * 3. Add as readonly property
 * 4. Initialize in constructor passing the options
 */

import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { AuthApi } from '@api/AuthApi';
import { BugsApi } from '@api/BugsApi';
import { ExampleApi } from '@api/ExampleApi';
import { WorkspaceApi } from '@api/WorkspaceApi';

// ============================================
// API Fixture Class
// ============================================

export class ApiFixture extends ApiBase {
  /** Auth component - handles login and token management */
  readonly auth: AuthApi;

  /** Example component - reference only */
  readonly example: ExampleApi;

  /** Workspace component - active-workspace switch operations */
  readonly workspace: WorkspaceApi;

  /** Bugs component - defect filing + assignment operations */
  readonly bugs: BugsApi;

  constructor(options: TestContextOptions) {
    super(options);

    // All components receive the same options (same request context)
    this.auth = new AuthApi(options);
    this.example = new ExampleApi(options);
    this.workspace = new WorkspaceApi(options);
    this.bugs = new BugsApi(options);
  }

  // ============================================
  // Token Propagation to Child Components
  // ============================================

  /**
   * Set authentication token for all API components.
   * This ensures all components use the same token for authenticated requests.
   */
  override setAuthToken(token: string) {
    super.setAuthToken(token);
    this.auth.setAuthToken(token);
    this.example.setAuthToken(token);
    this.workspace.setAuthToken(token);
    this.bugs.setAuthToken(token);
  }

  /**
   * Clear authentication token from all API components.
   */
  override clearAuthToken() {
    super.clearAuthToken();
    this.auth.clearAuthToken();
    this.example.clearAuthToken();
    this.workspace.clearAuthToken();
    this.bugs.clearAuthToken();
  }
}

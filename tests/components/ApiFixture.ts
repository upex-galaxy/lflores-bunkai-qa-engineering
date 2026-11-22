import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { AuthApi } from '@api/AuthApi';
import { AuthoringSweepApi } from '@api/AuthoringSweepApi';
import { BugsApi } from '@api/BugsApi';
import { CapabilityGateApi } from '@api/CapabilityGateApi';
import { CoverageApi } from '@api/CoverageApi';
import { ModulesApi } from '@api/ModulesApi';
import { NotificationsApi } from '@api/NotificationsApi';
import { ProjectsApi } from '@api/ProjectsApi';
import { RunsApi } from '@api/RunsApi';
import { TokensApi } from '@api/TokensApi';
import { WorkspaceApi } from '@api/WorkspaceApi';

export class ApiFixture extends ApiBase {
  readonly auth: AuthApi;

  readonly workspace: WorkspaceApi;

  readonly bugs: BugsApi;

  readonly notifications: NotificationsApi;

  readonly tokens: TokensApi;

  readonly modules: ModulesApi;

  readonly authoringSweep: AuthoringSweepApi;

  readonly capabilityGate: CapabilityGateApi;

  readonly projects: ProjectsApi;

  readonly coverage: CoverageApi;

  readonly runs: RunsApi;

  constructor(options: TestContextOptions) {
    super(options);

    this.auth = new AuthApi(options);
    this.workspace = new WorkspaceApi(options);
    this.bugs = new BugsApi(options);
    this.notifications = new NotificationsApi(options);
    this.tokens = new TokensApi(options);
    this.modules = new ModulesApi(options);
    this.authoringSweep = new AuthoringSweepApi(options);
    this.capabilityGate = new CapabilityGateApi(options);
    this.projects = new ProjectsApi(options);
    this.coverage = new CoverageApi(options);
    this.runs = new RunsApi(options);
  }

  override setAuthToken(token: string) {
    super.setAuthToken(token);
    this.auth.setAuthToken(token);
    this.workspace.setAuthToken(token);
    this.bugs.setAuthToken(token);
    this.notifications.setAuthToken(token);
    this.tokens.setAuthToken(token);
    this.modules.setAuthToken(token);
    this.authoringSweep.setAuthToken(token);
    this.capabilityGate.setAuthToken(token);
    this.projects.setAuthToken(token);
    this.coverage.setAuthToken(token);
    this.runs.setAuthToken(token);
  }

  override clearAuthToken() {
    super.clearAuthToken();
    this.auth.clearAuthToken();
    this.workspace.clearAuthToken();
    this.bugs.clearAuthToken();
    this.notifications.clearAuthToken();
    this.tokens.clearAuthToken();
    this.modules.clearAuthToken();
    this.authoringSweep.clearAuthToken();
    this.capabilityGate.clearAuthToken();
    this.projects.clearAuthToken();
    this.coverage.clearAuthToken();
    this.runs.clearAuthToken();
  }
}

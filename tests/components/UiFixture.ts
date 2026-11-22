import type { TestContextOptions } from '@TestContext';

import { HomePage } from '@ui/HomePage';
import { LoginPage } from '@ui/LoginPage';
import { UiBase } from '@ui/UiBase';

export class UiFixture extends UiBase {
  readonly login: LoginPage;

  readonly home: HomePage;

  constructor(options: TestContextOptions) {
    super(options);

    this.login = new LoginPage(options);
    this.home = new HomePage(options);
  }
}

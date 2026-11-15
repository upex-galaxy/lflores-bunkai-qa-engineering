/**
 * KATA Architecture - Layer 3: Home Page Component
 *
 * UI component for the Home dashboard (/home), starting with its "Coverage"
 * stat card (BK-259): the workspace percentage plus a three-way breakdown of
 * its acceptance criteria (ACs).
 *
 * Page: /home (Bunkai). Requires an authenticated session (storageState from
 * the ui-setup project). The card renders a skeleton first, so every read waits
 * on a web-first assertion rather than a fixed delay.
 *
 * Locators (data-testid):
 * - Card: [data-testid="home-coverage"]
 * - Percentage: [data-testid="home-coverage-percent"] ("NN%", or an em dash when there are no ACs)
 * - Chips: home-coverage-executed / home-coverage-not-run / home-coverage-uncovered
 *   (the count is the leading number of the chip text; the label follows it)
 * - Total: no testid. The card sentence reads "of N acceptance criteria across this workspace ..."
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc } from '@utils/decorators';

// ============================================
// Types
// ============================================

/** What the Coverage card prints, as numbers. */
export interface CoverageCardReading {
  /** Headline percentage, whole number (the "%" sign stripped) */
  percent: number
  /** Chip "executed" */
  executed: number
  /** Chip "awaiting execution" */
  notRun: number
  /** Chip "no coverage" */
  uncovered: number
  /** Total ACs, parsed from the card sentence */
  total: number
}

// ============================================
// Home Page Component
// ============================================

export class HomePage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: Open the Home screen and read the workspace Coverage card - expects a
   * percentage and a breakdown whose three chips add up to the total ACs
   *
   * Complete flow:
   * 1. Navigate to /home (ACTION)
   * 2. Wait for the card to leave its skeleton and show a percentage (fixed assertion)
   * 3. Read the three chips and the total from the card sentence (fixed assertions)
   * 4. Check executed + awaiting + no coverage equals the total (fixed assertion)
   *
   * Returns what the card shows so the test can compare it with the API rollup.
   *
   * @returns The card's numbers
   */
  @atc('BK-864')
  async showWorkspaceCoverage(): Promise<CoverageCardReading> {
    await this.page.goto(this.buildUrl('/home'));

    const card = this.page.locator('[data-testid="home-coverage"]');
    const percentLabel = card.locator('[data-testid="home-coverage-percent"]');

    // Fixed assertion - a real percentage, not the em dash an empty workspace shows
    await expect(percentLabel).toHaveText(/^\d+%$/);

    // Fixed assertions - the three chips and the sentence carrying the total are all there
    const chips = {
      executed: card.locator('[data-testid="home-coverage-executed"]'),
      notRun: card.locator('[data-testid="home-coverage-not-run"]'),
      uncovered: card.locator('[data-testid="home-coverage-uncovered"]'),
    };
    for (const chip of Object.values(chips)) {
      await expect(chip).toBeVisible();
    }
    const totalSentence = card.getByText(/of \d+ acceptance criteria/);
    await expect(totalSentence).toBeVisible();

    const reading: CoverageCardReading = {
      percent: this.firstNumber(await percentLabel.innerText(), 'percentage'),
      executed: this.firstNumber(await chips.executed.innerText(), 'executed chip'),
      notRun: this.firstNumber(await chips.notRun.innerText(), 'awaiting execution chip'),
      uncovered: this.firstNumber(await chips.uncovered.innerText(), 'no coverage chip'),
      total: this.firstNumber(await totalSentence.innerText(), 'total ACs'),
    };

    // Fixed assertion - the breakdown never loses or invents an AC
    expect(reading.executed + reading.notRun + reading.uncovered).toBe(reading.total);

    return reading;
  }

  // ============================================
  // Helpers (Private)
  // ============================================

  /** Parse the first whole number in a text, failing fast when there is none. */
  private firstNumber(text: string, what: string): number {
    const match = text.match(/\d+/);
    if (!match) {
      throw new Error(`[HomePage] No number found in the ${what}: "${text}"`);
    }
    return Number(match[0]);
  }
}

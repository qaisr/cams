import * as fs from 'node:fs';
import * as path from 'node:path';

import { chromium, type Page } from '@playwright/test';

interface Action {
  type:
    | 'click'
    | 'fill'
    | 'navigate'
    | 'wait'
    | 'screenshot'
    | 'hover'
    | 'select'
    | 'check'
    | 'keyboard';
  selector?: string;
  value?: string;
  url?: string;
  duration?: number;
  key?: string;
  description: string;
}

interface ActionResult {
  action: Action;
  success: boolean;
  error?: string;
  screenshotPath?: string;
  consoleMessages: string[];
  networkActivity: string[];
}

async function runInteractions(actionsFile: string): Promise<void> {
  const actions: Action[] = JSON.parse(fs.readFileSync(actionsFile, 'utf-8'));
  const outputDir = '.claude/browser-reports/interactions';
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: false, devtools: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page: Page = await context.newPage();

  const results: ActionResult[] = [];

  page.on('response', (response) => {
    if (response.status() >= 400) {
      console.log(
        `[network] ${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log(`Step ${i + 1}: ${action.description}`);

    const stepConsole: string[] = [];

    const consoleHandler = (msg: { type(): string; text(): string }) =>
      stepConsole.push(`[${msg.type()}] ${msg.text()}`);
    page.on('console', consoleHandler);

    const result: ActionResult = {
      action,
      success: false,
      consoleMessages: stepConsole,
      networkActivity: [],
    };

    try {
      switch (action.type) {
        case 'navigate':
          await page.goto(action.url!, { waitUntil: 'networkidle' });
          await page.waitForTimeout(1000);
          break;

        case 'click':
          await page.waitForSelector(action.selector!, { timeout: 10000 });
          await page.click(action.selector!);
          await page.waitForTimeout(500);
          break;

        case 'fill':
          await page.waitForSelector(action.selector!, { timeout: 10000 });
          await page.fill(action.selector!, action.value!);
          break;

        case 'hover':
          await page.hover(action.selector!);
          await page.waitForTimeout(300);
          break;

        case 'select':
          await page.selectOption(action.selector!, action.value!);
          break;

        case 'check':
          await page.check(action.selector!);
          break;

        case 'keyboard':
          await page.keyboard.press(action.key!);
          break;

        case 'wait':
          await page.waitForTimeout(action.duration || 1000);
          break;

        case 'screenshot':
          break;
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Failed: ${result.error}`);
    }

    const screenshotPath = path.join(outputDir, `step-${i + 1}.png`);
    await page.screenshot({ fullPage: false, path: screenshotPath });
    result.screenshotPath = screenshotPath;

    page.off('console', consoleHandler);
    results.push(result);

    if (!result.success) {
      console.log('  Stopping due to failure. Check report for details.');
      break;
    }
  }

  const reportPath = path.join(outputDir, 'interaction-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  const summaryLines = [
    '# Interaction Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Steps',
  ];

  for (const [i, result] of results.entries()) {
    const status = result.success ? '✅' : '❌';
    summaryLines.push(`### Step ${i + 1} ${status}: ${result.action.description}`);
    if (result.error) {
      summaryLines.push(`**Error:** ${result.error}`);
    }
    if (result.consoleMessages.length > 0) {
      summaryLines.push('**Console:**');
      summaryLines.push('```');
      summaryLines.push(...result.consoleMessages);
      summaryLines.push('```');
    }
    summaryLines.push(`**Screenshot:** ${result.screenshotPath}`);
    summaryLines.push('');
  }

  fs.writeFileSync(path.join(outputDir, 'summary.md'), summaryLines.join('\n'));

  console.log(`\n✅ Interaction complete. Report: ${reportPath}`);

  await browser.close();
}

const actionsFile = process.argv[2] || '.claude/browser-actions.json';
runInteractions(actionsFile).catch(console.error);

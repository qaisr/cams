import * as fs from 'node:fs';
import * as path from 'node:path';

import { chromium, type Browser, type Page } from '@playwright/test';

interface InspectionReport {
  url: string;
  timestamp: string;
  screenshot: string;
  consoleErrors: ConsoleMessage[];
  consoleWarnings: ConsoleMessage[];
  networkFailures: NetworkFailure[];
  networkRequests: NetworkRequest[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: Cookie[];
  pageTitle: string;
  htmlSnapshot: string;
  performanceMetrics: PerformanceMetrics;
}

interface ConsoleMessage {
  type: string;
  text: string;
  location?: { url: string; lineNumber: number };
}

interface NetworkFailure {
  url: string;
  method: string;
  status: number;
  statusText: string;
  timing: number;
  responseBody?: string;
}

interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  timing: number;
  resourceType: string;
}

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

interface PerformanceMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  largestContentfulPaint?: number;
}

async function inspectPage(
  targetUrl: string = 'http://localhost:3000',
  outputDir: string = '.claude/browser-reports',
  headless: boolean = true,
): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser: Browser = await chromium.launch({
    headless,
    devtools: !headless,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page: Page = await context.newPage();

  const consoleErrors: ConsoleMessage[] = [];
  const consoleWarnings: ConsoleMessage[] = [];
  const networkFailures: NetworkFailure[] = [];
  const networkRequests: NetworkRequest[] = [];

  page.on('console', (msg) => {
    const entry: ConsoleMessage = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    };

    if (msg.type() === 'error') {
      consoleErrors.push(entry);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(entry);
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push({
      type: 'uncaught-exception',
      text: `${error.message}\n${error.stack}`,
    });
  });

  // Storybook renders docs/stories inside #storybook-preview-iframe, whose
  // runtime errors do NOT bubble to the top-frame pageerror handler above.
  // Capture console + uncaught exceptions from every child frame too.
  const isStorybook = /[?&]path=\/(docs|story)/.test(targetUrl) || targetUrl.includes(':6006');
  page.on('frameattached', (frame) => {
    frame.on('pageerror', (error: Error) => {
      consoleErrors.push({
        type: 'iframe-uncaught-exception',
        text: `[frame ${frame.url()}] ${error.message}\n${error.stack}`,
      });
    });
  });

  // A dynamically-imported module that 404s surfaces as a failed request, not
  // a console error — this is the classic stale Storybook/Vite cache signature.
  page.on('requestfailed', (request) => {
    networkFailures.push({
      url: request.url(),
      method: request.method(),
      status: 0,
      statusText: request.failure()?.errorText ?? 'request failed',
      timing: 0,
      responseBody: '[request failed before response]',
    });
  });

  page.on('response', async (response) => {
    const request = response.request();
    const timing = response.request().timing();

    const entry: NetworkRequest = {
      url: request.url(),
      method: request.method(),
      status: response.status(),
      timing: timing.responseEnd - timing.requestStart,
      resourceType: request.resourceType(),
    };

    networkRequests.push(entry);

    if (response.status() >= 400) {
      let responseBody: string;
      try {
        responseBody = await response.text();
      } catch {
        responseBody = '[Could not read response body]';
      }

      networkFailures.push({
        ...entry,
        statusText: response.statusText(),
        responseBody: responseBody.substring(0, 2000),
      });
    }
  });

  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  // Storybook docs/stories mount lazily inside the preview iframe; give the
  // dynamic import time to resolve (or fail) before we snapshot.
  await page.waitForTimeout(isStorybook ? 4000 : 2000);

  const screenshotBuffer = await page.screenshot({
    fullPage: true,
    type: 'png',
  });
  const screenshotBase64 = screenshotBuffer.toString('base64');
  const screenshotPath = path.join(outputDir, 'screenshot.png');
  fs.writeFileSync(screenshotPath, screenshotBuffer);

  const localStorage = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)!;
      items[key] = window.localStorage.getItem(key) || '';
    }
    return items;
  });

  const sessionStorage = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)!;
      items[key] = window.sessionStorage.getItem(key) || '';
    }
    return items;
  });

  const cookies = await context.cookies();
  const htmlSnapshot = await page.content();

  const performanceMetrics = await page.evaluate((): PerformanceMetrics => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');
    const lcpEntries = performance.getEntriesByName('largest-contentful-paint');

    return {
      domContentLoaded:
        navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart || 0,
      loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
      firstPaint: paintEntries.find((e) => e.name === 'first-paint')?.startTime,
      largestContentfulPaint: lcpEntries[lcpEntries.length - 1]?.startTime,
    };
  });

  const report: InspectionReport = {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    screenshot: screenshotBase64,
    consoleErrors,
    consoleWarnings,
    networkFailures,
    networkRequests: networkRequests.filter(
      (r) => r.resourceType === 'fetch' || r.resourceType === 'xhr' || r.status >= 400,
    ),
    localStorage,
    sessionStorage,
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    })),
    pageTitle: await page.title(),
    htmlSnapshot: htmlSnapshot.substring(0, 50000),
    performanceMetrics,
  };

  const reportPath = path.join(outputDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const summaryPath = path.join(outputDir, 'summary.md');
  fs.writeFileSync(summaryPath, generateSummary(report));

  console.log(`\n✅ Inspection complete!`);
  console.log(`   Screenshot: ${screenshotPath}`);
  console.log(`   Report:     ${reportPath}`);
  console.log(`   Summary:    ${summaryPath}`);

  if (consoleErrors.length > 0) {
    console.log(`\n❌ ${consoleErrors.length} console error(s) found`);
  }
  if (networkFailures.length > 0) {
    console.log(`\n❌ ${networkFailures.length} network failure(s) found`);
  }

  await browser.close();
}

function generateSummary(report: InspectionReport): string {
  return `# Browser Inspection Report
Generated: ${report.timestamp}
URL: ${report.url}
Page Title: ${report.pageTitle}

## Console Errors (${report.consoleErrors.length})
${
  report.consoleErrors.length === 0
    ? '✅ No errors'
    : report.consoleErrors
        .map(
          (e) =>
            `### ${e.type}\n\`\`\`\n${e.text}\n\`\`\`\nLocation: ${e.location?.url}:${e.location?.lineNumber}`,
        )
        .join('\n\n')
}

## Console Warnings (${report.consoleWarnings.length})
${
  report.consoleWarnings.length === 0
    ? '✅ No warnings'
    : report.consoleWarnings.map((w) => `- ${w.text}`).join('\n')
}

## Network Failures (${report.networkFailures.length})
${
  report.networkFailures.length === 0
    ? '✅ No failures'
    : report.networkFailures
        .map(
          (f) =>
            `### ${f.status} ${f.statusText} - ${f.method} ${f.url}\n\`\`\`\n${f.responseBody}\n\`\`\``,
        )
        .join('\n\n')
}

## API Requests
${report.networkRequests
  .map((r) => `- ${r.status} ${r.method} ${r.url} (${Math.round(r.timing)}ms)`)
  .join('\n')}

## Performance
- DOM Content Loaded: ${Math.round(report.performanceMetrics.domContentLoaded)}ms
- Load Complete: ${Math.round(report.performanceMetrics.loadComplete)}ms
${report.performanceMetrics.firstPaint ? `- First Paint: ${Math.round(report.performanceMetrics.firstPaint)}ms` : ''}
${report.performanceMetrics.largestContentfulPaint ? `- LCP: ${Math.round(report.performanceMetrics.largestContentfulPaint)}ms` : ''}

## Storage
### localStorage
\`\`\`json
${JSON.stringify(report.localStorage, null, 2)}
\`\`\`

### sessionStorage
\`\`\`json
${JSON.stringify(report.sessionStorage, null, 2)}
\`\`\`

## Cookies
${report.cookies.map((c) => `- ${c.name}=${c.value} (${c.domain})`).join('\n')}
`;
}

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const positional = args.filter((a) => !a.startsWith('--'));
const url = positional[0] || 'http://localhost:3000';
const outputDir = positional[1] || '.claude/browser-reports';

inspectPage(url, outputDir, !headed).catch(console.error);

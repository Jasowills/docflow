import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '../client/src/assets');

const screenshots = [
  {
    name: 'docflow-showcase-dashboard.png',
    url: 'http://localhost:3000/app/dashboard',
    selector: '.app-shell',
    description: 'Recordings/Dashboard view',
  },
  {
    name: 'docflow-showcase-testplans.png',
    url: 'http://localhost:3000/app/generate',
    selector: '.app-shell',
    description: 'Generate Documents page',
  },
  {
    name: 'docflow-showcase-documents.png',
    url: 'http://localhost:3000/app/documents',
    selector: '.app-shell',
    description: 'Documents list view',
  },
];

async function captureScreenshots() {
  let browser;
  try {
    console.log('🚀 Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    
    // Set viewport to match typical landing page showcase dimensions
    await page.setViewport({
      width: 1400,
      height: 900,
      deviceScaleFactor: 2, // Retina quality
    });

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    for (const screenshot of screenshots) {
      try {
        console.log(`\n📸 Capturing: ${screenshot.description}`);
        console.log(`   URL: ${screenshot.url}`);

        // Navigate to the page
        await page.goto(screenshot.url, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });

        // Wait a bit for animations to settle
        await page.waitForTimeout(2000);

        // Wait for the main content to be visible
        await page.waitForSelector(screenshot.selector, { timeout: 10000 });

        // Take screenshot
        const screenshotPath = path.join(assetsDir, screenshot.name);
        await page.screenshot({
          path: screenshotPath,
          type: 'png',
          fullPage: false, // Capture viewport only
        });

        console.log(`   ✅ Saved to: ${screenshotPath}`);
      } catch (error) {
        console.error(`   ❌ Error capturing ${screenshot.description}:`, error.message);
      }
    }

    console.log('\n✨ Screenshot capture complete!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if servers are running before starting
async function checkServerHealth() {
  console.log('🔍 Checking if dev servers are running...');
  
  const checkUrl = async (url, name) => {
    try {
      const response = await fetch(url, { timeout: 5000 });
      console.log(`   ✅ ${name} is running (${response.status})`);
      return true;
    } catch (error) {
      console.log(`   ❌ ${name} is not responding`);
      return false;
    }
  };

  const clientOk = await checkUrl('http://localhost:3000', 'Client dev server');
  const serverOk = await checkUrl('http://localhost:3001', 'API server');

  if (!clientOk) {
    console.error('\n❌ Client dev server is not running!');
    console.error('   Run: npm run dev (from root or client directory)');
    process.exit(1);
  }

  if (!serverOk) {
    console.error('\n⚠️  API server is not responding');
    console.error('   The app might still work if using mocked data');
  }

  return true;
}

// Main execution
(async () => {
  await checkServerHealth();
  await captureScreenshots();
})();

/**
 * CSRF Protection Browser Test
 * Tests CSRF token functionality using Playwright
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function testCsrfProtection() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    consoleMessages: [],
    networkRequests: [],
    errors: [],
    success: true
  };

  // Capture console messages
  page.on('console', msg => {
    results.consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Capture network requests
  page.on('request', request => {
    if (request.url().includes('localhost:3000')) {
      const headers = request.headers();
      results.networkRequests.push({
        url: request.url(),
        method: request.method(),
        hasCSRFToken: 'x-csrf-token' in headers,
        csrfTokenValue: headers['x-csrf-token'] || null,
        hasCookie: 'cookie' in headers
      });
    }
  });

  // Capture errors
  page.on('pageerror', error => {
    results.errors.push({
      message: error.message,
      stack: error.stack
    });
  });

  try {
    console.log('\n🧪 Starting CSRF Protection Browser Test...\n');

    // Test 1: Backend CSRF token endpoint
    console.log('Test 1: Testing /csrf-token endpoint...');
    const response = await page.goto('http://localhost:3000/csrf-token');
    const tokenData = await response.json();

    const test1 = {
      name: 'CSRF Token Endpoint',
      passed: !!tokenData.csrfToken,
      details: {
        status: response.status(),
        hasToken: !!tokenData.csrfToken,
        tokenLength: tokenData.csrfToken?.length || 0
      }
    };
    results.tests.push(test1);
    console.log(test1.passed ? '✅ PASS' : '❌ FAIL', JSON.stringify(test1.details, null, 2));

    // Test 2: Verify _csrf cookie is set
    console.log('\nTest 2: Checking _csrf cookie...');
    const cookies = await context.cookies();
    const csrfCookie = cookies.find(c => c.name === '_csrf');

    const test2 = {
      name: 'CSRF Cookie Set',
      passed: !!csrfCookie,
      details: {
        cookieFound: !!csrfCookie,
        httpOnly: csrfCookie?.httpOnly || false,
        sameSite: csrfCookie?.sameSite || 'none',
        secure: csrfCookie?.secure || false,
        path: csrfCookie?.path || null
      }
    };
    results.tests.push(test2);
    console.log(test2.passed ? '✅ PASS' : '❌ FAIL', JSON.stringify(test2.details, null, 2));

    // Test 3: Load admin app and check for CSRF token fetch
    console.log('\nTest 3: Loading admin app at http://localhost:5175...');
    await page.goto('http://localhost:5175', {
      waitUntil: 'load',
      timeout: 60000
    });
    await page.waitForTimeout(3000); // Wait for React to render

    const test3 = {
      name: 'Admin App Loads',
      passed: page.url().includes('localhost:5175'),
      details: {
        finalUrl: page.url(),
        title: await page.title()
      }
    };
    results.tests.push(test3);
    console.log(test3.passed ? '✅ PASS' : '❌ FAIL', JSON.stringify(test3.details, null, 2));

    // Test 4: Check if CSRF token is fetched when needed
    console.log('\nTest 4: Checking for CSRF token in network requests...');
    const csrfTokenRequests = results.networkRequests.filter(r =>
      r.url.includes('/csrf-token')
    );
    const stateChangingRequests = results.networkRequests.filter(r =>
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.method)
    );

    const test4 = {
      name: 'CSRF Token Fetched',
      passed: csrfTokenRequests.length > 0,
      details: {
        tokenRequestCount: csrfTokenRequests.length,
        stateChangingRequestCount: stateChangingRequests.length,
        stateChangingWithToken: stateChangingRequests.filter(r => r.hasCSRFToken).length
      }
    };
    results.tests.push(test4);
    console.log(test4.passed ? '✅ PASS' : '❌ FAIL', JSON.stringify(test4.details, null, 2));

    // Test 5: Check console for CSRF errors
    console.log('\nTest 5: Checking console for CSRF errors...');
    const csrfErrors = results.consoleMessages.filter(m =>
      m.text.toLowerCase().includes('csrf') && m.type === 'error'
    );

    const test5 = {
      name: 'No CSRF Errors in Console',
      passed: csrfErrors.length === 0,
      details: {
        csrfErrorCount: csrfErrors.length,
        errors: csrfErrors.map(e => e.text)
      }
    };
    results.tests.push(test5);
    console.log(test5.passed ? '✅ PASS' : '❌ FAIL', JSON.stringify(test5.details, null, 2));

    // Take screenshot
    console.log('\nTaking screenshot...');
    await page.screenshot({
      path: 'csrf-test-screenshot.png',
      fullPage: true
    });
    console.log('Screenshot saved to csrf-test-screenshot.png');

    // Summary
    const passedTests = results.tests.filter(t => t.passed).length;
    const totalTests = results.tests.length;
    results.success = passedTests === totalTests;

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed\n`);
    results.tests.forEach(test => {
      console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    results.success = false;
    results.errors.push({
      message: error.message,
      stack: error.stack
    });
  } finally {
    // Save detailed results to file
    writeFileSync('csrf-test-results.json', JSON.stringify(results, null, 2));
    console.log('\nDetailed results saved to csrf-test-results.json');

    await browser.close();
  }

  return results;
}

// Run the test
testCsrfProtection().then(results => {
  process.exit(results.success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

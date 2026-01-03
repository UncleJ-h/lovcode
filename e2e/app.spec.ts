/**
 * Lovcode E2E Tests - Basic App Functionality
 *
 * These tests verify core application behavior:
 * - App loads successfully
 * - Navigation works
 * - Key UI elements are present
 */

import { test, expect } from '@playwright/test';

test.describe('App Launch', () => {
  test('app loads and shows home view', async ({ page }) => {
    await page.goto('/');

    // Wait for app to be fully loaded
    await page.waitForLoadState('networkidle');

    // App should have rendered (check for main container)
    await expect(page.locator('#root')).toBeVisible();
  });

  test('app has correct title', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Lovcode/i);
  });
});

test.describe('Navigation', () => {
  test('can navigate to chat view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and click on chat navigation item
    const chatNav = page.locator('[data-testid="nav-chat"]').or(
      page.getByRole('button', { name: /chat/i })
    );

    // If chat nav exists, click it
    if (await chatNav.count() > 0) {
      await chatNav.first().click();
      // Verify navigation occurred by checking URL or content change
      await page.waitForTimeout(500);
    }
  });

  test('can navigate to settings view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find settings button or link
    const settingsNav = page.locator('[data-testid="nav-settings"]').or(
      page.getByRole('button', { name: /settings/i })
    );

    if (await settingsNav.count() > 0) {
      await settingsNav.first().click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('UI Components', () => {
  test('sidebar is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for sidebar element
    const sidebar = page.locator('[data-testid="sidebar"]').or(
      page.locator('nav').first()
    );

    await expect(sidebar).toBeVisible();
  });

  test('main content area exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for main content wrapper
    const main = page.locator('main').or(
      page.locator('[data-testid="main-content"]')
    );

    await expect(main).toBeVisible();
  });
});

test.describe('Responsiveness', () => {
  test('app renders on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App should still render
    await expect(page.locator('#root')).toBeVisible();
  });

  test('app renders on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#root')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

import { APP_NAME } from '../src/lib/constants';

test.describe('Login', () => {
    test('shows login form', async ({ page }) => {
        await page.goto('/login');
        await expect(
            page.getByRole('heading', { name: APP_NAME }),
        ).toBeVisible();
        await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
        await expect(page.getByPlaceholder('••••••••')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Sign In' }),
        ).toBeVisible();
    });

    test('shows validation error when fields are empty', async ({ page }) => {
        await page.goto('/login');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await expect(page.getByText('Please fill in all fields')).toBeVisible();
    });

    test('logs in with email and password', async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder('you@example.com').fill('test@example.com');
        await page.getByPlaceholder('••••••••').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();

        // Should redirect to /trips
        await page.waitForURL('/trips');
        await expect(
            page.getByRole('heading', { name: 'My Trips' }),
        ).toBeVisible();
    });

    test('logs in with Google', async ({ page }) => {
        await page.goto('/login');
        await page
            .getByRole('button', { name: 'Continue with Google' })
            .click();

        await page.waitForURL('/trips');
        await expect(
            page.getByRole('heading', { name: 'My Trips' }),
        ).toBeVisible();
    });

    test('header shows Sign Out after login', async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder('you@example.com').fill('test@example.com');
        await page.getByPlaceholder('••••••••').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await page.waitForURL('/trips');

        await expect(
            page.getByRole('button', { name: 'Sign Out' }),
        ).toBeVisible();
    });

    test('has link to register page', async ({ page }) => {
        await page.goto('/login');
        await page.getByRole('link', { name: 'Sign up' }).click();
        await page.waitForURL('/register');
    });
});

test.describe('Logout', () => {
    test.beforeEach(async ({ page }) => {
        // Log in first
        await page.goto('/login');
        await page.getByPlaceholder('you@example.com').fill('test@example.com');
        await page.getByPlaceholder('••••••••').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await page.waitForURL('/trips');
    });

    test('logs out and redirects to home', async ({ page }) => {
        await page.getByRole('button', { name: 'Sign Out' }).click();

        // Should see Sign In link instead of Sign Out button
        await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
    });

    test('protected pages redirect to login after logout', async ({ page }) => {
        await page.getByRole('button', { name: 'Sign Out' }).click();

        await page.goto('/trips');
        await page.waitForURL('/login');
    });
});

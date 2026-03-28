import { expect, test } from '@playwright/test';

test.describe('Authenticated navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder('you@example.com').fill('test@example.com');
        await page.getByPlaceholder('••••••••').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await page.waitForURL('/trips');
    });

    test('header shows authenticated nav links', async ({ page }) => {
        const nav = page.locator('nav');
        await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'My Trips' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Account' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'FAQ' })).toBeVisible();
    });

    test('navigates to My Trips', async ({ page }) => {
        await page.getByRole('link', { name: 'My Trips' }).click();
        await page.waitForURL('/trips');
        await expect(
            page.getByRole('heading', { name: 'My Trips' }),
        ).toBeVisible();
        await expect(page.getByText('Barcelona, Spain')).toBeVisible();
    });

    test('navigates to Account', async ({ page }) => {
        await page.getByRole('link', { name: 'Account' }).click();
        await page.waitForURL('/account');
        await expect(
            page.getByRole('heading', { name: 'Account' }),
        ).toBeVisible();
    });

    test('navigates to FAQ', async ({ page }) => {
        await page.getByRole('link', { name: 'FAQ' }).click();
        await page.waitForURL('/faq');
        await expect(
            page.getByRole('heading', { name: 'Frequently Asked Questions' }),
        ).toBeVisible();
    });

    test('navigates to Home', async ({ page }) => {
        await page.getByRole('link', { name: 'FAQ' }).click();
        await page.waitForURL('/faq');

        await page.getByRole('link', { name: 'Home' }).click();
        await page.waitForURL('/');
    });

    test('navigates to a trip detail page', async ({ page }) => {
        await page.getByText('Barcelona, Spain').click();
        await page.waitForURL('/trips/1');
    });
});

test.describe('Unauthenticated navigation', () => {
    test('header shows public nav links only', async ({ page }) => {
        await page.goto('/');
        const nav = page.locator('nav');
        await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'FAQ' })).toBeVisible();
        await expect(
            nav.getByRole('link', { name: 'My Trips' }),
        ).not.toBeVisible();
        await expect(
            nav.getByRole('link', { name: 'Account' }),
        ).not.toBeVisible();
    });

    test('shows Sign In link', async ({ page }) => {
        await page.goto('/');
        await expect(
            page.getByRole('banner').getByRole('link', { name: 'Sign In' }),
        ).toBeVisible();
    });

    test('redirects /trips to /login when not authenticated', async ({
        page,
    }) => {
        await page.goto('/trips');
        await page.waitForURL('/login');
    });

    test('redirects /account to /login when not authenticated', async ({
        page,
    }) => {
        await page.goto('/account');
        await page.waitForURL('/login');
    });
});

import { expect, test } from '@playwright/test';
import { cleanupRegistrations } from './helpers/db';
import {
  completeInfoAndContinueToPayment,
  enablePreregistrationSession,
  fillContactForm,
  fillStudentForm,
  getSessionRegistrationIds,
  payByCheck,
  submitStudentForm,
  uniqueTestPerson,
} from './helpers/registration';

/**
 * Pre-registration for current students (before registrationOpens).
 *
 * Uses September Guitar 1 (opens 8/22/2026) and August Guitar 1 as the
 * current-enrollment class. Skip / adjust if those frontmatter dates change.
 */
const CURRENT_CLASS = '2026/08/guitar1';
const UPCOMING_CLASS = '2026/09/guitar1';
const UPCOMING_OTHER_CLASS = '2026/09/piano1a';
const OPENS_LABEL = /Registration opens\s+Aug 22/i;

test.describe('class pre-registration', () => {
  let createdRegistrationIds: string[] = [];

  test.afterEach(async () => {
    await cleanupRegistrations(createdRegistrationIds);
    createdRegistrationIds = [];
  });

  test('shows disabled opens label on activities without the unlock flag', async ({
    page,
  }) => {
    await page.goto('/activities?kind=class');
    const card = page.locator(`[id="${UPCOMING_CLASS}"]`);
    await expect(card).toBeVisible();

    const registerBtn = card.locator('.register-btn');
    await expect(registerBtn).toContainText(OPENS_LABEL, { timeout: 20_000 });
    await expect(registerBtn).toHaveClass(/is-disabled/);
    await expect(registerBtn).toHaveAttribute('aria-disabled', 'true');
  });

  test('shows Pre-register Now after visiting ?preregister', async ({
    page,
  }) => {
    await enablePreregistrationSession(page);
    await page.goto('/activities?kind=class');

    const card = page.locator(`[id="${UPCOMING_CLASS}"]`);
    await expect(card).toBeVisible();
    const registerBtn = card.locator('.register-btn');
    await expect(registerBtn).toHaveText(/Pre-register Now/i, {
      timeout: 20_000,
    });
    await expect(registerBtn).not.toHaveClass(/is-disabled/);
  });

  test('hides the register form until pre-registration is unlocked', async ({
    page,
  }) => {
    await page.goto(`/register/${UPCOMING_CLASS}`);
    await expect(page.locator('#registration-opens-notice')).toBeVisible();
    await expect(page.locator('#registration-opens-label')).toHaveText(
      /Aug 22/i
    );
    await expect(page.locator('#registration-form')).toBeHidden();
    await expect(page.locator('.preregistration-hint')).toBeHidden();

    await enablePreregistrationSession(page);
    await page.goto(`/register/${UPCOMING_CLASS}`);
    await expect(page.locator('#registration-form')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.preregistration-hint')).toBeVisible();
  });

  test('rejects students who are not currently enrolled in a class', async ({
    page,
  }) => {
    const person = uniqueTestPerson('New');
    await enablePreregistrationSession(page);

    await submitStudentForm(page, UPCOMING_CLASS, person.student);

    const message = page.locator('#registration-form #form-message');
    await expect(message).toHaveText(
      `Pre-registration for Guitar 1 is not available for ${person.student.firstName} ${person.student.lastName} because they are not currently enrolled in Guitar 1`
    );
    await expect(page).toHaveURL(new RegExp(`/register/${UPCOMING_CLASS}`));
  });

  test('rejects enrolled students pre-registering for a differently named class', async ({
    page,
  }) => {
    const person = uniqueTestPerson('Mismatch');

    await fillStudentForm(page, CURRENT_CLASS, person.student);
    const currentIds = await getSessionRegistrationIds(page);
    expect(currentIds).toHaveLength(1);
    createdRegistrationIds.push(currentIds[0]);

    await fillContactForm(page, person.contact);
    await completeInfoAndContinueToPayment(page);
    await payByCheck(page);
    await expect(page.locator('body')).toContainText(/confirmation|success/i);

    await enablePreregistrationSession(page);
    await submitStudentForm(page, UPCOMING_OTHER_CLASS, person.student);

    const message = page.locator('#registration-form #form-message');
    await expect(message).toHaveText(
      `Pre-registration for Beginning Piano (4pm) is not available for ${person.student.firstName} ${person.student.lastName} because they are not currently enrolled in Beginning Piano (4pm)`
    );
    await expect(page).toHaveURL(
      new RegExp(`/register/${UPCOMING_OTHER_CLASS}`)
    );
  });

  test('allows a currently enrolled student to pre-register', async ({
    page,
  }) => {
    const person = uniqueTestPerson('Current');

    // Establish paid enrollment in a class that has not ended.
    await fillStudentForm(page, CURRENT_CLASS, person.student);
    const currentIds = await getSessionRegistrationIds(page);
    expect(currentIds).toHaveLength(1);
    createdRegistrationIds.push(currentIds[0]);

    await fillContactForm(page, person.contact);
    await completeInfoAndContinueToPayment(page);
    await payByCheck(page);
    await expect(page.locator('body')).toContainText(/confirmation|success/i);

    // Unlock pre-registration and register the same student for the upcoming class.
    await enablePreregistrationSession(page);
    await fillStudentForm(page, UPCOMING_CLASS, person.student);
    const upcomingIds = await getSessionRegistrationIds(page);
    expect(upcomingIds).toHaveLength(1);
    createdRegistrationIds.push(upcomingIds[0]);

    await fillContactForm(page, person.contact);
    await completeInfoAndContinueToPayment(page);
    await payByCheck(page);
    await expect(page.locator('body')).toContainText(/confirmation|success/i);
  });
});

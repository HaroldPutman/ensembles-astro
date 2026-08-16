import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type StudentInfo = {
  firstName: string;
  lastName: string;
  birthdate: string;
};

export type ContactInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export async function submitStudentForm(
  page: Page,
  activityId: string,
  student: StudentInfo
): Promise<void> {
  await page.goto(`/register/${activityId}`);
  const form = page.locator('#registration-form');
  await expect(form).toBeVisible();
  await form.locator('#birthdate').fill(student.birthdate);
  await form.locator('#birthdate').blur();
  await form.locator('#firstName').fill(student.firstName);
  await form.locator('#lastName').fill(student.lastName);
  await form.getByRole('button', { name: 'Next: Contact Information' }).click();
}

export async function fillStudentForm(
  page: Page,
  activityId: string,
  student: StudentInfo
): Promise<void> {
  await submitStudentForm(page, activityId, student);
  await page.waitForURL(/\/register\/contact\?/);
}

export async function fillContactForm(
  page: Page,
  contact: ContactInfo
): Promise<void> {
  const form = page.locator('#contact-form');
  await form.locator('#firstName').fill(contact.firstName);
  await form.locator('#lastName').fill(contact.lastName);
  await form.locator('#email').fill(contact.email);
  if (contact.phone) {
    await form.locator('#phone').fill(contact.phone);
  }
  await Promise.all([
    page.waitForURL(/\/register\/info\//),
    form.getByRole('button', { name: 'Next: Additional Information' }).click(),
  ]);
}

export async function completeInfoAndContinueToPayment(
  page: Page
): Promise<void> {
  const form = page.locator('#registration-info-form');
  await form.locator('#termsAgreement').check();
  await Promise.all([
    page.waitForURL(/\/register\/payment/),
    form.getByRole('button', { name: 'Continue to Payment' }).click(),
  ]);
}

export async function payByCheck(page: Page): Promise<void> {
  await page.locator('#payment-content').waitFor({ state: 'visible' });
  await Promise.all([
    page.waitForURL(/\/register\/success/),
    page.locator('#alternate-payment-btn').click(),
  ]);
}

export async function getSessionRegistrationIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    try {
      const raw = sessionStorage.getItem('registrations') || '[]';
      // Keep as strings — Cockroach IDs exceed Number.MAX_SAFE_INTEGER
      return (JSON.parse(raw) as Array<string | number>).map(String);
    } catch {
      return [];
    }
  });
}

export async function setSessionRegistrationIds(
  page: Page,
  ids: string[]
): Promise<void> {
  await page.evaluate(registrationIds => {
    sessionStorage.setItem('registrations', JSON.stringify(registrationIds));
  }, ids);
}

/** Unlock class pre-registration for this browser session via `?preregister`. */
export async function enablePreregistrationSession(page: Page): Promise<void> {
  // Use home — avoids depending on /activities content being sortable.
  await page.goto('/?preregister');
  await page.waitForFunction(
    () => sessionStorage.getItem('preregistration') === 'true'
  );
  await expect(page).not.toHaveURL(/[?&]preregister/);
}

export function uniqueTestPerson(prefix: string) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    student: {
      firstName: `${prefix}Student`,
      lastName: `E2E${stamp}`,
      // Age ~12 at Aug 2026 class start dates
      birthdate: '01/15/2014',
    } satisfies StudentInfo,
    contact: {
      firstName: `${prefix}Parent`,
      lastName: `E2E${stamp}`,
      email: `e2e-${prefix.toLowerCase()}-${stamp}@example.com`,
      phone: '502-555-0100',
    } satisfies ContactInfo,
  };
}

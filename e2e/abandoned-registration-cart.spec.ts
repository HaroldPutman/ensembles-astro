import { expect, test } from '@playwright/test';
import {
  cleanupRegistrations,
  getPaymentById,
  getRegistrationsByIds,
} from './helpers/db';
import {
  fillContactForm,
  fillStudentForm,
  getSessionRegistrationIds,
  payByCheck,
  completeInfoAndContinueToPayment,
  uniqueTestPerson,
} from './helpers/registration';

/**
 * Regression for a production incident:
 * A parent starts registration for class A but leaves before paying, then
 * completes registration + payment for class B in the same browser tab.
 *
 * Starting a new class (without "Add Another Registration") must replace the
 * cart so the abandoned class is not marked paid.
 */
const CLASS_A = '2026/08/piano2';
const CLASS_B = '2026/08/guitar1';
const CLASS_B_COST = 75;

test.describe('abandoned registration cart pollution', () => {
  let createdRegistrationIds: string[] = [];

  test.afterEach(async () => {
    await cleanupRegistrations(createdRegistrationIds);
    createdRegistrationIds = [];
  });

  test('paying for a second class does not mark an abandoned first registration as paid', async ({
    page,
  }) => {
    const personA = uniqueTestPerson('A');
    const personB = uniqueTestPerson('B');

    // --- Class A: start registration, stop before payment / before cost is set ---
    await fillStudentForm(page, CLASS_A, personA.student);
    const idsAfterA = await getSessionRegistrationIds(page);
    expect(idsAfterA).toHaveLength(1);
    const abandonedRegistrationId = idsAfterA[0];
    createdRegistrationIds.push(abandonedRegistrationId);

    await fillContactForm(page, personA.contact);
    // Leave without completing info/payment — mimics backing out mid-flow.

    // --- Class B: complete registration and pay by check ---
    await fillStudentForm(page, CLASS_B, personB.student);
    const idsAfterBStudent = await getSessionRegistrationIds(page);
    expect(idsAfterBStudent).toHaveLength(1);
    expect(idsAfterBStudent).not.toContain(abandonedRegistrationId);
    const paidRegistrationId = idsAfterBStudent[0];
    createdRegistrationIds.push(paidRegistrationId);

    await fillContactForm(page, personB.contact);
    await completeInfoAndContinueToPayment(page);

    const idsOnPayment = await getSessionRegistrationIds(page);
    expect(idsOnPayment).toEqual([paidRegistrationId]);

    await payByCheck(page);
    await expect(page.locator('body')).toContainText(/confirmation|success/i);

    const [abandoned, completed] = await Promise.all([
      getRegistrationsByIds([abandonedRegistrationId]).then(rows => rows[0]),
      getRegistrationsByIds([paidRegistrationId]).then(rows => rows[0]),
    ]);

    expect(completed).toBeTruthy();
    expect(completed.activity.toLowerCase()).toBe(CLASS_B);
    expect(completed.payment_id).not.toBeNull();
    expect(Number(completed.cost)).toBe(CLASS_B_COST);

    const payment = await getPaymentById(completed.payment_id!);
    expect(payment).toBeTruthy();
    expect(Number(payment!.amount)).toBe(CLASS_B_COST);

    // Abandoned class A must remain unpaid / not enrolled.
    expect(abandoned.activity.toLowerCase()).toBe(CLASS_A);
    expect(abandoned.cost).toBeNull();
    expect(abandoned.payment_id).toBeNull();
  });
});

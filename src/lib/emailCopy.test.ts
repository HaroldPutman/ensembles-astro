import { formatEnjoyingClassHope } from './emailCopy';

describe('formatEnjoyingClassHope', () => {
  const tina = { firstName: 'Tina', lastName: 'Smith' };
  const john = { firstName: 'John', lastName: 'Smith' };
  const roshni = { firstName: 'Roshni', lastName: 'Patel' };
  const parent = { firstName: 'Jane', lastName: 'Smith' };
  const adult = { firstName: 'Alex', lastName: 'Nguyen' };

  it('uses a first name for one student who is not the contact', () => {
    expect(formatEnjoyingClassHope('Guitar 1', [tina], parent)).toBe(
      'We hope Tina is enjoying the Guitar 1 class.'
    );
  });

  it('joins two students with and', () => {
    expect(
      formatEnjoyingClassHope('Beginning Piano', [tina, john], parent)
    ).toBe('We hope Tina and John are enjoying the Beginning Piano class.');
  });

  it('says you when the student is the contact', () => {
    expect(formatEnjoyingClassHope('Adult Piano', [adult], adult)).toBe(
      'We hope you are enjoying the Adult Piano class.'
    );
  });

  it('puts you first when the contact is also a student', () => {
    expect(formatEnjoyingClassHope('Sitar', [roshni, adult], adult)).toBe(
      'We hope you and Roshni are enjoying the Sitar class.'
    );
  });

  it('uses an oxford comma for three or more names', () => {
    const sam = { firstName: 'Sam', lastName: 'Lee' };
    expect(formatEnjoyingClassHope('Choir', [tina, john, sam], parent)).toBe(
      'We hope Tina, John, and Sam are enjoying the Choir class.'
    );
  });

  it('matches names case-insensitively', () => {
    expect(
      formatEnjoyingClassHope(
        'Adult Piano',
        [{ firstName: 'ALEX', lastName: 'nguyen' }],
        adult
      )
    ).toBe('We hope you are enjoying the Adult Piano class.');
  });
});

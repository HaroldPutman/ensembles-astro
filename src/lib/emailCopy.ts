export interface PersonName {
  firstName: string;
  lastName: string;
}

function normalizeNamePart(value: string): string {
  return value.trim().toLowerCase();
}

export function namesMatch(a: PersonName, b: PersonName): boolean {
  return (
    normalizeNamePart(a.firstName) === normalizeNamePart(b.firstName) &&
    normalizeNamePart(a.lastName) === normalizeNamePart(b.lastName)
  );
}

function joinHopeSubjects(labels: string[]): string {
  if (labels.length === 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  const last = labels[labels.length - 1];
  return `${labels.slice(0, -1).join(', ')}, and ${last}`;
}

/**
 * Casual opener for a current-class email, using first names or "you"
 * when the student is the contact.
 */
export function formatEnjoyingClassHope(
  className: string,
  students: PersonName[],
  contact: PersonName
): string {
  const others: string[] = [];
  let includesYou = false;

  for (const student of students) {
    const first = student.firstName.trim();
    if (!first) continue;
    if (namesMatch(student, contact)) {
      includesYou = true;
    } else {
      others.push(first);
    }
  }

  const labels = [...(includesYou ? ['you'] : []), ...others];
  if (labels.length === 0) {
    return `We hope you are enjoying the ${className} class.`;
  }

  const subject = joinHopeSubjects(labels);
  const verb = labels.length === 1 && labels[0] !== 'you' ? 'is' : 'are';
  return `We hope ${subject} ${verb} enjoying the ${className} class.`;
}

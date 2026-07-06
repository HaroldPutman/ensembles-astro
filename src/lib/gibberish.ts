const COMMON_ENGLISH_WORDS = new Set(
  `
a about after all also an and any are as at be because been before being but by
can come could day do does doing done each email even every first for from get
go good had has have he her here hi him his how i if in into is it its just
know like look make me message more my name need new no not now of on one or
other our out over please question re really say see she should so some thank
thanks that the their them then there these they this those time to too up us
use very want was we well what when where which who why will with would write
you your about activity after again against ago all almost already always am
among another around ask away back bad best better between both call came can
child children class classes come contact could course dear did different does
done down during each early end enough especially even ever every family far
feel few find first follow following found free friend friends give going great
group had happen happy having help here high hope hour hours however idea
important include including information interest interested interested join just
keep kids kind know large last late later learn least leave left less let life
like little live long look looking lot love made make many may maybe mean might
mind minute minutes miss month months morning most mother much must my myself
name near need never next night no none nor not note nothing now number of off
often old once only open or other others our out outside over own part people
person place play please point possible program programs put question questions
quick quite rather read ready really reason register registration right room
run same say school see seem seen send set several shall she should show side
since small so some someone something sometimes son soon sorry sound start
still stop such sure take talk tell than thank that the their them then there
these they thing things think this those though thought three through time to
today together told too took try trying turn two under until up upon us use
used using very want way we week weeks well went were what when where whether
which while who whole whom whose why will wish with within without wonder work
working world would write year years yes yet you young your yours
`
    .trim()
    .split(/\s+/)
);

function shannonEntropy(text: string): number {
  const freq = new Map<string, number>();
  for (const char of text) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

export function gibberishScore(text: string): number {
  const value = text.trim();
  if (value.length < 4) return 0;

  let score = 0;
  const letters = value.replace(/[^a-zA-Z]/g, '');
  const vowels = (letters.match(/[aeiouAEIOU]/g) ?? []).length;

  if (letters.length >= 8 && vowels / letters.length < 0.2) score += 2;
  if (value.length >= 12 && !value.includes(' ')) score += 2;
  if (/[a-z][A-Z][a-z][A-Z]/.test(value)) score += 1;
  if (shannonEntropy(value) > 4.0) score += 1;

  const words = value.toLowerCase().split(/\s+/).filter(Boolean);
  const knownWords = words.filter(word =>
    COMMON_ENGLISH_WORDS.has(word)
  ).length;
  if (words.length >= 2 && knownWords === 0) score += 2;

  return score;
}

export function hasEnglishWords(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  return words.some(word => COMMON_ENGLISH_WORDS.has(word));
}

export function isSpamMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  return (
    gibberishScore(text) >= 4 || (text.length > 30 && !hasEnglishWords(text))
  );
}

export function isSpamName(name: string): boolean {
  const text = name.trim();
  if (!text) return false;

  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 20) return false;
  if (text.includes(' ')) return false;

  const vowels = (letters.match(/[aeiouAEIOU]/g) ?? []).length;
  return vowels / letters.length < 0.15;
}

export function isSpamContactSubmission(
  name: string,
  message: string
): boolean {
  return isSpamName(name) || isSpamMessage(message);
}

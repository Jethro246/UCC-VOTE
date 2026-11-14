import type { HallUnit } from '../types';

export const UNVERIFIED_HALL_MESSAGE =
  'Your hall affiliation could not be verified. Please contact the appropriate administrator.';

export function normalizeHallText(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Matches a student's or candidate's registered hall against a target hall name, ID, code, or recognized alias.
 * Carefully isolates 'SRC Hall' / 'SRC Hostel' so university-wide 'SRC' never falsely matches a residential hall,
 * and ensures unverified affiliations (e.g., 'Off-Campus Private Hostel') never resolve to an official hall.
 */
export function matchesHallAffiliation(
  studentHall: string | undefined,
  targetHall: string | undefined,
  hallUnit?: Pick<HallUnit, 'id' | 'code' | 'name' | 'shortName' | 'displayName'>
): boolean {
  const s = normalizeHallText(studentHall);
  const t = normalizeHallText(targetHall);
  if (!s) return false;

  if (hallUnit) {
    if (s === normalizeHallText(hallUnit.id)) return true;
    if (hallUnit.code && s === normalizeHallText(hallUnit.code)) return true;
    if (hallUnit.displayName && s === normalizeHallText(hallUnit.displayName)) return true;
  }

  if (!t) return false;
  if (s === t) return true;

  if (hallUnit) {
    if (t === normalizeHallText(hallUnit.id) && matchesHallAffiliation(studentHall, hallUnit.name)) {
      return true;
    }
    if (hallUnit.code && t === normalizeHallText(hallUnit.code) && matchesHallAffiliation(studentHall, hallUnit.name)) {
      return true;
    }
  }

  const sClean = s.replace(/\bhall\b/g, '').trim();
  const tClean = t.replace(/\bhall\b/g, '').trim();
  if (sClean && tClean && sClean === tClean) return true;

  // 1. Casely Hayford Hall (Casford)
  if (
    (s.includes('casford') || s.includes('casely hayford') || s === 'hall-casford' || s === 'hall-cas') &&
    (t.includes('casford') || t.includes('casely hayford') || t === 'hall-casford' || t === 'hall-cas')
  ) {
    return true;
  }

  // 2. Kwame Nkrumah Hall (KNH)
  if (
    (s.includes('kwame nkrumah') || s === 'knh' || s === 'hall-knh') &&
    (t.includes('kwame nkrumah') || t === 'knh' || t === 'hall-knh')
  ) {
    return true;
  }

  // 3. Atlantic Hall (ATL)
  if (
    (s.includes('atlantic') || s === 'atl' || s === 'hall-atlantic' || s === 'hall-atl') &&
    (t.includes('atlantic') || t === 'atl' || t === 'hall-atlantic' || t === 'hall-atl')
  ) {
    return true;
  }

  // 4. Adehye Hall
  if (
    (s.includes('adehye') || s === 'hall-adehye' || s === 'hall-ade') &&
    (t.includes('adehye') || t === 'hall-adehye' || t === 'hall-ade')
  ) {
    return true;
  }

  // 5. Oguaa Hall
  if (
    (s.includes('oguaa') || s === 'hall-oguaa' || s === 'hall-ogu') &&
    (t.includes('oguaa') || t === 'hall-oguaa' || t === 'hall-ogu')
  ) {
    return true;
  }

  // 6. Valco Hall
  if (
    (s.includes('valco') || s === 'hall-valco' || s === 'hall-val') &&
    (t.includes('valco') || t === 'hall-valco' || t === 'hall-val')
  ) {
    return true;
  }

  // 7. SRC Hall (explicitly require 'src hall', 'src hostel', 'hall-src' — never bare 'src')
  const isSrcHall = (val: string) =>
    val === 'src hall' ||
    val === 'src hostel' ||
    val === 'hall-src' ||
    val === 'hall_src';
  if (isSrcHall(s) && isSrcHall(t)) {
    return true;
  }

  // 8. Superannuation Hall (Super Hall) — also maps legacy 'Superannuation Hostel'
  const isSuperHall = (val: string) =>
    val.includes('superannuation') ||
    val === 'super hall' ||
    val === 'super' ||
    val === 'hall-super' ||
    val === 'hall-sup';
  if (isSuperHall(s) && isSuperHall(t)) {
    return true;
  }

  return false;
}

export function findMatchingHallUnit(
  hallNameOrId: string | undefined,
  halls: HallUnit[]
): HallUnit | undefined {
  if (!hallNameOrId || !hallNameOrId.trim()) return undefined;
  const q = normalizeHallText(hallNameOrId);
  return halls.find(
    (h) =>
      normalizeHallText(h.id) === q ||
      (h.code && normalizeHallText(h.code) === q) ||
      (h.displayName && normalizeHallText(h.displayName) === q) ||
      matchesHallAffiliation(hallNameOrId, h.name, h) ||
      matchesHallAffiliation(hallNameOrId, h.shortName, h)
  );
}

export function getHallDisplayName(hall?: Pick<HallUnit, 'name' | 'shortName' | 'displayName'>): string {
  if (!hall) return '';
  if (hall.displayName) return hall.displayName;
  if (
    hall.shortName &&
    normalizeHallText(hall.shortName) !== normalizeHallText(hall.name) &&
    !normalizeHallText(hall.name).includes(normalizeHallText(hall.shortName))
  ) {
    return `${hall.name} (${hall.shortName})`;
  }
  return hall.name;
}

export function isProfileComplete(profile) {
  if (!profile) return false;

  const academicStanding = String(profile.academicStanding ?? "").trim();
  const major = String(profile.major ?? "").trim();
  const startingTerm = String(profile.startingTerm ?? "").trim();

  return (
    academicStanding.length > 0 && major.length > 0 && startingTerm.length > 0
  );
}

export function hasCompletedOnboarding(userRecord) {
  if (!userRecord) return false;

  const majorId = String(userRecord.major_id ?? "").trim();
  const startingTermId = String(userRecord.starting_term_id ?? "").trim();

  return majorId.length > 0 && startingTermId.length > 0;
}

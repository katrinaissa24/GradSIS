export function autoAssignBuckets(courses, requirements) {
  const buckets = Object.keys(requirements);
  const earned = Object.fromEntries(buckets.map((b) => [b, 0]));
  const assignment = {}; // courseId -> bucket

  const deficit = (b) => Math.max(0, requirements[b] - earned[b]);

  const remainingEligibleCount = (remainingCourses, b) =>
    remainingCourses.reduce(
      (acc, c) => acc + (c.eligibleBuckets.includes(b) ? 1 : 0),
      0
    );

  const singles = courses.filter((c) => c.eligibleBuckets.length === 1);
  const multis = courses.filter((c) => c.eligibleBuckets.length > 1);

  for (const c of singles) {
    const b = c.eligibleBuckets[0];
    assignment[c.id] = b;
    earned[b] += c.credits;
  }

  const remaining = [...multis];
  while (remaining.length) {
    remaining.sort((a, b) => a.eligibleBuckets.length - b.eligibleBuckets.length);
    const c = remaining.shift();

    const best = c.eligibleBuckets
      .map((b) => ({ b, d: deficit(b), scarcity: remainingEligibleCount(remaining, b) }))
      .sort((x, y) => (y.d !== x.d ? y.d - x.d : x.scarcity - y.scarcity))[0].b;

    assignment[c.id] = best;
    earned[best] += c.credits;
  }

  return { assignment, earned };
}
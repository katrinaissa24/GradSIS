import { gradePoints } from "../constants/grades";

export function calculateSemesterGPA(courses) {
  let totalPoints = 0;
  let totalCredits = 0;

  courses.forEach(c => {
    if (c.grade && gradePoints[c.grade]) {
      totalPoints += gradePoints[c.grade] * c.courses.credits;
      totalCredits += c.courses.credits;
    }
  });

  if (!totalCredits) return "0.00";
  return (totalPoints / totalCredits).toFixed(2);
}

export function calculateCredits(courses) {
  return courses.reduce((sum, c) => sum + c.courses.credits, 0);
}
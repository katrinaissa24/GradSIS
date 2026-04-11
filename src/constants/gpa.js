import { gradePoints } from "../constants/grades";

export function getCourseCredits(c) {
  if (c?.credits != null && c.credits !== "") return Number(c.credits) || 0;
  if (c?.courses?.credits != null) return Number(c.courses.credits) || 0;
  return 0;
}

export function calculateSemesterGPA(courses) {
  let totalPoints = 0;
  let totalCredits = 0;

  courses.forEach((c) => {
    if (c.grade && Object.prototype.hasOwnProperty.call(gradePoints, c.grade)) {
      const credits = getCourseCredits(c);
      totalPoints += gradePoints[c.grade] * credits;
      totalCredits += credits;
    }
  });

  if (!totalCredits) return "0.00";
  return (totalPoints / totalCredits).toFixed(2);
}

export function calculateCredits(courses) {
  return courses.reduce((sum, c) => sum + getCourseCredits(c), 0);
}

export function calculateCumulativeGPAWithRepeats(allCourses, semesters) {
  const latestGradedAttempts = getLatestGradedAttempts(allCourses, semesters);

  let totalPoints = 0;
  let totalCredits = 0;

  latestGradedAttempts.forEach((c) => {
    if (c.grade && Object.prototype.hasOwnProperty.call(gradePoints, c.grade)) {
      const credits = getCourseCredits(c);
      totalPoints += gradePoints[c.grade] * credits;
      totalCredits += credits;
    }
  });

  if (!totalCredits) return "0.00";
  return (totalPoints / totalCredits).toFixed(2);
}

export function calculateGPACreditHours(allCourses, semesters) {
  const latestGradedAttempts = getLatestGradedAttempts(allCourses, semesters);
  return latestGradedAttempts.reduce((sum, c) => sum + getCourseCredits(c), 0);
}

function getLatestGradedAttempts(allCourses, semesters) {
  const semesterMap = new Map(
    semesters.map((sem) => [sem.id, sem.semester_number || 0]),
  );

  const latestByCourseId = new Map();

  allCourses.forEach((course) => {
    if (!course?.course_id) return;
    if (!course?.grade) return;
    if (!Object.prototype.hasOwnProperty.call(gradePoints, course.grade))
      return;

    const existing = latestByCourseId.get(course.course_id);

    if (!existing) {
      latestByCourseId.set(course.course_id, course);
      return;
    }

    const currentSemesterNumber = semesterMap.get(course.semester_id) || 0;
    const existingSemesterNumber = semesterMap.get(existing.semester_id) || 0;

    if (currentSemesterNumber > existingSemesterNumber) {
      latestByCourseId.set(course.course_id, course);
    }
  });

  return [...latestByCourseId.values()];
}

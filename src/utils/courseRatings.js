export async function getCourseAverageRating(supabase, courseId) {
  const { data, error } = await supabase
    .from("course_reviews")
    .select("difficulty")
    .eq("course_id", courseId);

  if (error || !data || data.length === 0) {
    return { avg: 0, count: 0 };
  }

  const avg =
    data.reduce((sum, r) => sum + Number(r.difficulty || 0), 0) / data.length;

  return {
    avg: avg,
    count: data.length,
  };
}
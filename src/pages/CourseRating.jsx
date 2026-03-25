import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function CourseRating() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userReview, setUserReview] = useState(null);
  const [hasTaken, setHasTaken] = useState(false);

  const [comment, setComment] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);

      const { data: courseData } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();
      setCourse(courseData);

      const { data: enrollment } = await supabase
        .from("user_courses")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", courseId);

      setHasTaken(enrollment && enrollment.length > 0);

      await fetchReviews(user.id);
      setLoading(false);
    }
    load();
  }, [courseId]);

  async function fetchReviews(uid) {
    const { data } = await supabase
      .from("course_reviews")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    setReviews(data || []);

    const existing = (data || []).find((r) => r.user_id === uid);
    if (existing) {
      setUserReview(existing);
      setComment(existing.comment || "");
    }
  }

  async function handleSubmit() {
    if (!comment.trim()) {
      setMessage({ text: "Please write a comment.", type: "error" });
      return;
    }

    setSubmitting(true);

    if (userReview) {
      const { error } = await supabase
        .from("course_reviews")
        .update({ comment })
        .eq("id", userReview.id);

      if (error) {
        setMessage({ text: "Failed to update review.", type: "error" });
      } else {
        setMessage({ text: "Review updated!", type: "success" });
        await fetchReviews(userId);
      }
    } else {
      const { error } = await supabase
        .from("course_reviews")
        .insert({ user_id: userId, course_id: courseId, comment });

      if (error) {
        setMessage({ text: "Failed to submit review.", type: "error" });
      } else {
        setMessage({ text: "Review submitted!", type: "success" });
        await fetchReviews(userId);
      }
    }

    setSubmitting(false);
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!course) return <div style={{ padding: 24 }}>Course not found.</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      {/* Back button */}
      <button onClick={() => navigate(-1)} style={{
        marginBottom: 20, background: "none", border: "1px solid #ddd",
        borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13,
      }}>
        ← Back
      </button>

      {/* Course info */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{course.code} {course.number}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{course.name}</h1>
        <div style={{ fontSize: 14, color: "#374151" }}>{course.credits} credits</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Submit review — only if user has taken the course */}
      {hasTaken ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            {userReview ? "Update Your Review" : "Leave a Review"}
          </h2>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Comment</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Share your experience with this course..."
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid #ddd", fontSize: 13, resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {message && (
            <div style={{
              marginBottom: 12, padding: "8px 12px", borderRadius: 8, fontSize: 13,
              background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
              color: message.type === "success" ? "#059669" : "#dc2626",
              border: `1px solid ${message.type === "success" ? "#d1fae5" : "#fecaca"}`,
            }}>
              {message.text}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: "#111", color: "#fff", cursor: "pointer",
              fontSize: 14, opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Submitting..." : userReview ? "Update Review" : "Submit Review"}
          </button>
        </div>
      ) : (
        <div style={{
          background: "#fef9c3", border: "1px solid #fde68a",
          borderRadius: 14, padding: 16, marginBottom: 24,
          fontSize: 13, color: "#92400e",
        }}>
          ⚠ You can only review courses you have taken.
        </div>
      )}

      {/* Reviews list */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
        {reviews.length} Review{reviews.length !== 1 ? "s" : ""}
      </h2>

      {reviews.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>No reviews yet. Be the first!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{
              background: "#fff", borderRadius: 12, padding: 16,
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              border: r.user_id === userId ? "2px solid #111" : "1px solid #eee",
            }}>
              {r.user_id === userId && (
                <div style={{ fontSize: 10, fontWeight: 700, color: "#111", marginBottom: 6, textTransform: "uppercase" }}>
                  Your Review
                </div>
              )}
              {r.comment && (
                <div style={{ fontSize: 13, color: "#374151" }}>{r.comment}</div>
              )}
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

function getDifficultyLabel(d) {
  if (d < 1.5) return "Very Easy";
  if (d < 2.5) return "Easy";
  if (d < 3.5) return "Medium";
  if (d < 4.5) return "Hard";
  return "Very Hard";
}

export default function CourseRating() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sortOption, setSortOption] = useState("newest");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userReview, setUserReview] = useState(null);
  const [hasTaken, setHasTaken] = useState(false);

  const [comment, setComment] = useState("");
  const [message, setMessage] = useState(null);
  const [difficulty, setDifficulty] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState(null);
  const [averageDifficulty, setAverageDifficulty] = useState(0);
  const [recommendStats, setRecommendStats] = useState({ up: 0, down: 0 });

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

    const allReviews = data || [];
    const up = allReviews.filter(r => r.would_recommend === true).length;
    const down = allReviews.filter(r => r.would_recommend === false).length;

    setRecommendStats({ up, down });

    if (allReviews.length > 0) {
      const avg =
        allReviews.reduce((sum, r) => sum + Number(r.difficulty || 0), 0) / allReviews.length;
      setAverageDifficulty(avg);
    } else {
      setAverageDifficulty(0);
    }

    const existing = (data || []).find((r) => r.user_id === uid);
    if (existing) {
      setUserReview(existing);
      setComment(existing.comment || "");
      setDifficulty(existing.difficulty || 0);
      setWouldRecommend(existing.would_recommend);
    }
  }

  async function handleSubmit() {
    if (difficulty === 0 && wouldRecommend === null && !comment.trim()) {
  setMessage({ text: "Please fill at least one review field.", type: "error" });
  return;
}

    setSubmitting(true);

    if (userReview) {
      
        const updates = {};

        if (comment.trim()) updates.comment = comment.trim();
        if (difficulty !== 0) updates.difficulty = difficulty;
        if (wouldRecommend !== null) updates.would_recommend = wouldRecommend;

        const { error } = await supabase
        .from("course_reviews")
        .update(updates)
        .eq("id", userReview.id);

      if (error) {
        setMessage({ text: "Failed to update review.", type: "error" });
      } else {
        setMessage({ text: "Review updated!", type: "success" });
        await fetchReviews(userId);
        setComment("");
      }
    } else {
      const newReview = {
        user_id: userId,
        course_id: courseId,
      };

      if (comment.trim()) newReview.comment = comment.trim();
      if (difficulty !== 0) newReview.difficulty = difficulty;
      if (wouldRecommend !== null) newReview.would_recommend = wouldRecommend;

      const { error } = await supabase
        .from("course_reviews")
        .insert(newReview);

      if (error) {
        setMessage({ text: "Failed to submit review.", type: "error" });
      } else {
        setMessage({ text: "Review submitted!", type: "success" });
        await fetchReviews(userId);
        setComment("");
      }
    }

    setSubmitting(false);
  }

  const visibleReviews = reviews
    .filter((review) => {
      if (ratingFilter === "all") return true;
      return Number(review.difficulty || 0) >= Number(ratingFilter);
    })
    .sort((a, b) => {
      if (sortOption === "highest") {
        return Number(b.difficulty || 0) - Number(a.difficulty || 0);
      }

      if (sortOption === "lowest") {
        return Number(a.difficulty || 0) - Number(b.difficulty || 0);
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

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
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
        {reviews.length} review{reviews.length !== 1 ? "s" : ""}
        </div>

        {reviews.length > 0 && (
  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
    <div style={{ fontSize: 18, fontWeight: 700 }}>
      {averageDifficulty.toFixed(2)} ★
    </div>
    <div style={{ fontSize: 12, color: "#6b7280" }}>
      {getDifficultyLabel(averageDifficulty)}
    </div>
    <div style={{ marginTop: 6, fontSize: 13, color: "#374151" }}>
      {recommendStats.up} 👍 / {recommendStats.down} 👎
    </div>
  </div>
)}

        

      </div>

      {/* Submit review — only if user has taken the course */}
      {hasTaken ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            {userReview ? "Update Your Review" : "Leave a Review"}
          </h2>
<div style={{ marginBottom: 14 }}>
  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
    Difficulty ({difficulty || 0}/5)
  </div>

  <div style={{ display: "flex", gap: 8 }}>
    {[1, 2, 3, 4, 5].map((star) => {
      let fillPercent = 0;
      if (difficulty >= star) fillPercent = 100;
      else if (difficulty >= star - 0.5) fillPercent = 50;

      return (
        <div
          key={star}
          style={{
            position: "relative",
            width: 28,
            height: 28,
            cursor: "pointer",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            style={{ position: "absolute", inset: 0 }}
          >
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
              fill="#d1d5db"
            />
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${fillPercent}%`,
              overflow: "hidden",
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28 }}>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                fill="#facc15"
              />
            </svg>
          </div>

          <div
            onClick={() => setDifficulty(star - 0.5)}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "50%",
              height: "100%",
              zIndex: 2,
            }}
          />

          <div
            onClick={() => setDifficulty(star)}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: "50%",
              height: "100%",
              zIndex: 2,
            }}
          />
        </div>
      );
    })}
  </div>
</div>
      
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

          <div style={{ marginTop: 10, marginBottom: 20 }}>
  <button
    onClick={handleSubmit}
    disabled={submitting}
    style={{
      padding: "10px 20px",
      borderRadius: 8,
      border: "none",
      background: "#111",
      color: "#fff",
      cursor: "pointer",
      fontSize: 14,
      opacity: submitting ? 0.7 : 1,
    }}
  >
    {submitting ? "Submitting..." : userReview ? "Update Review" : "Submit Review"}
  </button>
</div>



          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Would you recommend this course?
          </div>
          <button
          type="button"
          onClick={() => setWouldRecommend(true)}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: wouldRecommend === true ? "2px solid #16a34a" : "1px solid #d1d5db",
            background: wouldRecommend === true ? "#f0fdf4" : "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          👍 Yes
        </button>

        <button
          type="button"
          onClick={() => setWouldRecommend(false)}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: wouldRecommend === false ? "2px solid #dc2626" : "1px solid #d1d5db",
            background: wouldRecommend === false ? "#fef2f2" : "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          👎 No
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {visibleReviews.length} Review{visibleReviews.length !== 1 ? "s" : ""}
          </h2>
          {reviews.length > 0 && visibleReviews.length !== reviews.length && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              Showing {visibleReviews.length} of {reviews.length} reviews
            </div>
          )}
        </div>

        {reviews.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#4b5563" }}>
              Filter by rating
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                style={{
                  minWidth: 140,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                <option value="all">All ratings</option>
                <option value="4">4 stars & up</option>
                <option value="3">3 stars & up</option>
                <option value="2">2 stars & up</option>
                <option value="1">1 star & up</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#4b5563" }}>
              Sort reviews
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                style={{
                  minWidth: 140,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                <option value="newest">Newest first</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>No reviews yet. Be the first!</div>
      ) : visibleReviews.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>
          No reviews match the selected rating filter.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleReviews.map((r) => (
  <div
    key={r.id}
    style={{
      background: "#fff",
      borderRadius: 14,
      padding: 18,
      boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      border: r.user_id === userId ? "2px solid #111" : "1px solid #e5e7eb",
    }}
  >
    {r.user_id === userId && (
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#111",
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Your Review
      </div>
    )}

    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => {
          let fillPercent = 0;
          if (r.difficulty >= star) fillPercent = 100;
          else if (r.difficulty >= star - 0.5) fillPercent = 50;

          return (
            <div key={star} style={{ position: "relative", width: 18, height: 18 }}>
              <svg viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }}>
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                  fill="#d1d5db"
                />
              </svg>

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${fillPercent}%`,
                  overflow: "hidden",
                }}
              >
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                    fill="#facc15"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
        {r.difficulty}/5
      </div>
    </div>

    {r.comment && (
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
        {r.comment}
      </div>
    )}

    <div style={{
  marginTop: 8,
  fontSize: 13,
  fontWeight: 600,
  color: r.would_recommend ? "#16a34a" : "#dc2626"
}}>
  {r.would_recommend ? "👍 Recommended" : "👎 Not recommended"}
</div>

    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
      {new Date(r.created_at).toLocaleDateString()}
    </div>
  </div>
))}
        </div>
      )}
    </div>
  );
}

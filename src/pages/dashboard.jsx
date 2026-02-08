import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        // ❌ not logged in → block access
        navigate("/auth");
        return;
      }

      // ✅ logged in
      setUser(data.session.user);
      setLoading(false);
    };

    checkSession();
  }, [navigate]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Main App Page</h1>
      <p>Welcome {user.email}</p>

      <button onClick={async () => {
        await supabase.auth.signOut();
        navigate("/auth");
      }}>
        Logout
      </button>
    </div>
  );
}
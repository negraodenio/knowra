"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/supabase-browser";

const USER_ID_KEY = "knowra_learner_user_id";
const ACTIVE_GOAL_KEY = "knowra_learner_active_goal_id";

export interface LearnerGoal {
  id: string;
  userId: string;
  domainId: string;
  title: string;
  normalizedObjective: string;
  targetOutcome: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  createdAt: string;
}

export function useLearner() {
  const router = useRouter();
  const [userId, setUserIdState] = useState<string | null>(null);
  const [userEmail, setUserEmailState] = useState<string | null>(null);
  const [activeGoalId, setActiveGoalIdState] = useState<string | null>(null);
  const [goals, setGoals] = useState<LearnerGoal[]>([]);
  const [activeGoal, setActiveGoal] = useState<LearnerGoal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize from Supabase Auth session with fallback for test environments
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    // Check active Supabase session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!isMounted) return;
      if (user?.id) {
        setUserIdState(user.id);
        setUserEmailState(user.email ?? null);
        if (typeof window !== "undefined") {
          const previousUserId = localStorage.getItem(USER_ID_KEY);
          if (previousUserId && previousUserId !== user.id) {
            // User changed or new user logged in: purge stale active goal from previous session
            localStorage.removeItem(ACTIVE_GOAL_KEY);
            setActiveGoalIdState(null);
            setActiveGoal(null);
          } else {
            const storedGoal = localStorage.getItem(ACTIVE_GOAL_KEY);
            if (storedGoal) {
              setActiveGoalIdState(storedGoal);
            }
          }
          localStorage.setItem(USER_ID_KEY, user.id);
        }
      } else {
        setUserIdState(null);
        setUserEmailState(null);
        setActiveGoalIdState(null);
        setActiveGoal(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem(USER_ID_KEY);
          localStorage.removeItem(ACTIVE_GOAL_KEY);
        }
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    // Real-time auth state subscription (§S8.3)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (session?.user?.id) {
        setUserIdState(session.user.id);
        setUserEmailState(session.user.email ?? null);
        if (typeof window !== "undefined") {
          localStorage.setItem(USER_ID_KEY, session.user.id);
          window.dispatchEvent(new Event("knowra_user_changed"));
        }
      } else if (event === "SIGNED_OUT") {
        setUserIdState(null);
        setUserEmailState(null);
        setActiveGoalIdState(null);
        setActiveGoal(null);
        setGoals([]);
        if (typeof window !== "undefined") {
          localStorage.removeItem(USER_ID_KEY);
          localStorage.removeItem(ACTIVE_GOAL_KEY);
          window.dispatchEvent(new Event("knowra_user_changed"));
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Test helper and local override (isolated to test harness)
  const setUserId = useCallback((newUserId: string) => {
    setUserIdState(newUserId);
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_ID_KEY, newUserId);
      localStorage.removeItem(ACTIVE_GOAL_KEY);
      setActiveGoalIdState(null);
      window.dispatchEvent(new Event("knowra_user_changed"));
    }
  }, []);

  // Authoritative sign out via Supabase Auth (§S8.3)
  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Best-effort remote signout
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem(ACTIVE_GOAL_KEY);
      window.dispatchEvent(new Event("knowra_user_changed"));
    }

    setUserIdState(null);
    setUserEmailState(null);
    setActiveGoalIdState(null);
    setActiveGoal(null);
    setGoals([]);

    router.push("/");
  }, [router]);

  const selectGoal = useCallback(async (goalId: string) => {
    if (!userId) return;
    setActiveGoalIdState(goalId);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_GOAL_KEY, goalId);
      window.dispatchEvent(new Event("knowra_goal_changed"));
    }
    try {
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ activeGoalId: goalId }),
      });
    } catch {
      // Best-effort PATCH
    }
  }, [userId]);

  const refreshGoals = useCallback(async () => {
    if (!userId) {
      setGoals([]);
      setActiveGoal(null);
      setActiveGoalIdState(null);
      return;
    }
    try {
      const res = await fetch("/api/goals", {
        headers: { "x-user-id": userId },
      });
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
        if (data.activeGoal) {
          setActiveGoal(data.activeGoal);
          setActiveGoalIdState(data.activeGoal.id);
          if (typeof window !== "undefined") {
            localStorage.setItem(ACTIVE_GOAL_KEY, data.activeGoal.id);
          }
        } else if (data.goals && data.goals.length > 0) {
          const first = data.goals[0];
          setActiveGoal(first);
          setActiveGoalIdState(first.id);
          if (typeof window !== "undefined") {
            localStorage.setItem(ACTIVE_GOAL_KEY, first.id);
          }
        } else {
          setActiveGoal(null);
          setActiveGoalIdState(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem(ACTIVE_GOAL_KEY);
          }
        }
      }
    } catch {
      // Failed to load
    }
  }, [userId]);

  useEffect(() => {
    refreshGoals();

    const handleUserChange = () => {
      refreshGoals();
    };
    const handleGoalChange = () => {
      refreshGoals();
    };

    window.addEventListener("knowra_user_changed", handleUserChange);
    window.addEventListener("knowra_goal_changed", handleGoalChange);

    return () => {
      window.removeEventListener("knowra_user_changed", handleUserChange);
      window.removeEventListener("knowra_goal_changed", handleGoalChange);
    };
  }, [userId, refreshGoals]);

  return {
    userId: userId || "",
    userEmail: userEmail || "",
    setUserId,
    signOut,
    activeGoalId,
    activeGoal,
    goals,
    selectGoal,
    refreshGoals,
    loading,
    isAuthenticated: Boolean(userId),
  };
}

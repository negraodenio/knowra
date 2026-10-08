"use client";

import { useState, useEffect, useCallback } from "react";

const USER_ID_KEY = "knowra_learner_user_id";
const ACTIVE_GOAL_KEY = "knowra_learner_active_goal_id";
const DEFAULT_USER_ID = "test-learner-1";

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
  const [userId, setUserIdState] = useState<string>(DEFAULT_USER_ID);
  const [activeGoalId, setActiveGoalIdState] = useState<string | null>(null);
  const [goals, setGoals] = useState<LearnerGoal[]>([]);
  const [activeGoal, setActiveGoal] = useState<LearnerGoal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem(USER_ID_KEY);
      if (storedUser) {
        setUserIdState(storedUser);
      } else {
        localStorage.setItem(USER_ID_KEY, DEFAULT_USER_ID);
      }

      const storedGoal = localStorage.getItem(ACTIVE_GOAL_KEY);
      if (storedGoal) {
        setActiveGoalIdState(storedGoal);
      }
    }
  }, []);

  const setUserId = useCallback((newUserId: string) => {
    setUserIdState(newUserId);
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_ID_KEY, newUserId);
      localStorage.removeItem(ACTIVE_GOAL_KEY);
      setActiveGoalIdState(null);
      window.dispatchEvent(new Event("knowra_user_changed"));
    }
  }, []);

  const selectGoal = useCallback(async (goalId: string) => {
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
    setLoading(true);
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
        }
      }
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
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
    userId,
    setUserId,
    activeGoalId,
    activeGoal,
    goals,
    selectGoal,
    refreshGoals,
    loading,
  };
}

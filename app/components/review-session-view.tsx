"use client";

import { useEffect, useState } from "react";
import { ReviewItemEntity } from "@/lib/learning/state/review-service";
import { ReviewRating } from "@/lib/learning/spaced-repetition/types";

interface ReviewSessionViewProps {
  goalId: string;
  userId?: string;
  onReviewComplete?: () => void;
  onClose?: () => void;
}

export function ReviewSessionView({
  goalId,
  userId = "00000000-0000-0000-0000-000000000001",
  onReviewComplete,
  onClose,
}: ReviewSessionViewProps) {
  const [queue, setQueue] = useState<ReviewItemEntity[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    async function loadQueue() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/learning/review?goalId=${goalId}&limit=10`, {
          headers: { "x-user-id": userId },
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load review queue.");
        }
        const data = await res.json();
        setQueue(data.queue || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    loadQueue();
  }, [goalId, userId]);

  const handleRating = async (rating: ReviewRating) => {
    const currentItem = queue[currentIndex];
    if (!currentItem) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/learning/review/${currentItem.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ rating }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record review answer.");
      }

      const data = await res.json();
      setLastResult(
        `Answer recorded (${rating}). Next review in ${data.schedulingResult?.intervalDays || 1} day(s).`
      );

      if (currentIndex + 1 < queue.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setQueue([]);
        if (onReviewComplete) onReviewComplete();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-sky-500/30 bg-slate-900/90 rounded-2xl p-6 text-slate-300 text-sm text-center">
        Loading spaced repetition review queue...
      </div>
    );
  }

  const currentItem = queue[currentIndex];

  return (
    <div className="border border-sky-500/30 bg-slate-900/90 rounded-2xl p-6 shadow-xl space-y-5 text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
            Spaced Repetition Review Engine
          </span>
          <h3 className="text-lg font-bold text-white">
            {queue.length > 0
              ? `Review Item ${currentIndex + 1} of ${queue.length}`
              : "Review Queue Complete"}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
          >
            Close
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {lastResult && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-lg">
          {lastResult}
        </div>
      )}

      {currentItem ? (
        <div className="space-y-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-mono">Competency Due</span>
            <h4 className="text-base font-semibold text-white font-mono">{currentItem.competencyId}</h4>
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
              <span>Scheduler: {currentItem.schedulerType}</span>
              <span>Reviews Completed: {currentItem.reviewCount}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Recall this competency&apos;s concepts or execution steps from memory, then rate your retrieval difficulty:
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
            <button
              onClick={() => handleRating("AGAIN")}
              disabled={submitting}
              className="py-2.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              Again (Lapse)
            </button>
            <button
              onClick={() => handleRating("HARD")}
              disabled={submitting}
              className="py-2.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              Hard (Effort)
            </button>
            <button
              onClick={() => handleRating("GOOD")}
              disabled={submitting}
              className="py-2.5 px-3 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              Good (Normal)
            </button>
            <button
              onClick={() => handleRating("EASY")}
              disabled={submitting}
              className="py-2.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              Easy (Rapid)
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-slate-400">
          No review items currently due. Memory stability is on track!
        </div>
      )}
    </div>
  );
}

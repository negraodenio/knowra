import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { reviewService } from "@/lib/learning/state/review-service";
import { UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { ReviewRatingSchema } from "@/lib/learning/spaced-repetition/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { rating, score } = body;

    const ratingParse = ReviewRatingSchema.safeParse(rating);
    if (!ratingParse.success) {
      return NextResponse.json(
        { error: "Invalid rating. Must be 'AGAIN', 'HARD', 'GOOD', or 'EASY'." },
        { status: 400 }
      );
    }

    const numericScore = typeof score === "number" ? score : rating === "AGAIN" ? 30 : rating === "HARD" ? 65 : rating === "GOOD" ? 85 : 100;

    const result = await reviewService.answerReviewItem(
      userId,
      id,
      ratingParse.data,
      numericScore
    );

    return NextResponse.json({
      success: true,
      reviewItem: result.reviewItem,
      schedulingResult: result.schedulingResult,
      masteryOutput: result.masteryOutput,
    });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

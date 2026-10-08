import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/get-user";
import { productEventService, ProductEventType } from "@/lib/observability/product-events";

const ALLOWED_PUBLIC_EVENTS: ProductEventType[] = [
  "landing_viewed",
  "landing_how_it_works_clicked",
  "landing_cta_clicked",
  "signup_started",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, payload = {}, goalId, domainId, anonymousId } = body;

    if (!eventType) {
      return NextResponse.json({ error: "eventType is required" }, { status: 400 });
    }

    const authUserId = await getAuthenticatedUserId(req);
    const userId = authUserId || (anonymousId ? `anon-${String(anonymousId).slice(0, 32)}` : "anonymous-visitor");

    // Check if anonymous user is allowed to emit this event
    if (!authUserId && !ALLOWED_PUBLIC_EVENTS.includes(eventType as ProductEventType)) {
      return NextResponse.json({ error: "Unauthorized event for anonymous visitor" }, { status: 403 });
    }

    // Filter out any potential sensitive payload keys (no passwords, tokens, PII)
    const sanitizedPayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (!["password", "token", "secret", "apiKey", "auth"].includes(k.toLowerCase())) {
        sanitizedPayload[k] = v;
      }
    }

    const event = productEventService.recordEvent(
      userId,
      eventType as ProductEventType,
      sanitizedPayload,
      goalId,
      domainId
    );

    return NextResponse.json({ ok: true, eventId: event.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { scrapeKeyword } from "../../../lib/naver-scraper.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const keyword = body?.keyword?.trim();

    if (!keyword) {
      return NextResponse.json(
        { error: "keyword 값이 필요합니다." },
        { status: 400 }
      );
    }

    const payload = await scrapeKeyword(keyword);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "수집 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

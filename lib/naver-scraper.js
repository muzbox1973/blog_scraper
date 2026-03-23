import fs from "node:fs/promises";
import path from "node:path";

const SEARCH_BASE_URL = "https://search.naver.com/search.naver";
const OUTPUT_DIR = path.resolve("output");
const RESULT_LIMIT = 3;
const DEFAULT_WAIT_MS = 1200;
const SHOULD_PERSIST_OUTPUT = !process.env.VERCEL;
const PLAYWRIGHT_WS_ENDPOINT = process.env.PLAYWRIGHT_WS_ENDPOINT;
const CHROME_CDP_URL = process.env.CHROME_CDP_URL;

const STOPWORDS = new Set([
  "그리고",
  "하지만",
  "그러나",
  "또한",
  "정말",
  "이번",
  "통해",
  "관련",
  "포스팅",
  "블로그",
  "내용",
  "사용",
  "후기",
  "정리",
  "리뷰",
  "추천",
  "정보",
  "오늘",
  "내일",
  "지난",
  "사진",
  "영상",
  "링크",
  "여기",
  "저기",
  "너무",
  "아주",
  "진짜",
  "대한",
  "에서",
  "으로",
  "까지",
  "입니다",
  "있습니다",
  "했습니다",
  "하면서",
  "같아요",
  "because",
  "about",
  "with",
  "this",
  "that"
]);

function buildSearchUrl(keyword) {
  const url = new URL(SEARCH_BASE_URL);
  url.searchParams.set("where", "blog");
  url.searchParams.set("sm", "tab_opt");
  url.searchParams.set("query", keyword);
  return url.toString();
}

async function ensureOutputDir() {
  if (!SHOULD_PERSIST_OUTPUT) {
    return;
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhitespace(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function cleanupArticleText(text = "") {
  const blockedLines = new Set([
    "본문 바로가기",
    "블로그",
    "검색 MY메뉴 열기",
    "이웃추가",
    "본문 기타 기능",
    "예약",
    "이 블로그의 체크인",
    "이 장소의 다른 글"
  ]);

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }
      if (blockedLines.has(line)) {
        return false;
      }
      if (/^©\s?naver corp\.?$/i.test(line)) {
        return false;
      }
      if (/^\d+m$/.test(line)) {
        return false;
      }
      if (/^\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\./.test(line)) {
        return false;
      }
      return true;
    })
    .join(" ");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "keyword";
}

function toMobileBlogUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "m.blog.naver.com") {
      return url.toString();
    }
    if (url.hostname === "blog.naver.com") {
      url.hostname = "m.blog.naver.com";
      return url.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function extractKeywords(title, body, limit = 10) {
  const combined = `${title} ${body}`.toLowerCase();
  const tokens = combined.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
  const counts = new Map();

  for (const token of tokens) {
    if (STOPWORDS.has(token)) {
      continue;
    }
    if (/^\d+$/.test(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}

async function getBrowser() {
  if (PLAYWRIGHT_WS_ENDPOINT) {
    const { chromium } = await import("playwright-core");
    return chromium.connect(PLAYWRIGHT_WS_ENDPOINT);
  }

  if (CHROME_CDP_URL) {
    const { chromium } = await import("playwright-core");
    return chromium.connectOverCDP(CHROME_CDP_URL);
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Vercel serverless runtime cannot launch the bundled Chromium in this deployment. Set PLAYWRIGHT_WS_ENDPOINT or CHROME_CDP_URL to use a remote browser."
    );
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}

async function collectSearchResults(page) {
  await page.waitForLoadState("domcontentloaded");
  await wait(DEFAULT_WAIT_MS);

  return page.evaluate((limit) => {
    const isArticleUrl = (href) => {
      try {
        const url = new URL(href);
        if (!["blog.naver.com", "m.blog.naver.com", "blog.me"].includes(url.hostname)) {
          return false;
        }

        if (url.searchParams.has("logNo")) {
          return true;
        }

        const parts = url.pathname.split("/").filter(Boolean);
        return parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1]);
      } catch {
        return false;
      }
    };

    const anchors = Array.from(document.querySelectorAll("a[href]")).filter((anchor) =>
      isArticleUrl(anchor.href || "")
    );

    const seen = new Set();
    const results = [];

    for (const anchor of anchors) {
      const href = anchor.href.trim().split("#")[0];
      if (!href || seen.has(href)) {
        continue;
      }

      const card =
        anchor.closest('[data-template-id="ugcItem"]') ||
        anchor.closest(".api_subject_bx") ||
        anchor.closest("div, li, section, article") ||
        anchor.parentElement ||
        document.body;

      seen.add(href);
      results.push({
        title: (anchor.textContent || anchor.getAttribute("title") || "").trim(),
        url: href,
        preview: (card?.innerText || "").trim()
      });

      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }, RESULT_LIMIT);
}

async function extractFromBlogPage(page, rawUrl) {
  const targetUrl = toMobileBlogUrl(rawUrl);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await wait(DEFAULT_WAIT_MS);

  const result = await page.evaluate(() => {
    const textFromSelectors = (selectors) => {
      for (const selector of selectors) {
        const node = document.querySelector(selector);
        const text = node?.innerText?.trim();
        if (text) {
          return text;
        }
      }
      return "";
    };

    return {
      title: textFromSelectors([
        ".se-title-text span",
        ".se_title .se_textarea",
        ".pcol1 .tit_h2",
        ".title_text",
        ".end_tit",
        "h3",
        "h1"
      ]),
      body: textFromSelectors([
        ".se-main-container",
        "#postViewArea",
        ".post-view",
        ".view",
        ".post_ct",
        ".section_t1",
        "#viewTypeSelector"
      ])
    };
  });

  return {
    url: targetUrl,
    title: normalizeWhitespace(result.title),
    body: normalizeWhitespace(cleanupArticleText(result.body))
  };
}

export async function scrapeKeyword(keyword) {
  const trimmedKeyword = keyword?.trim();

  if (!trimmedKeyword) {
    throw new Error("검색 키워드를 입력해 주세요.");
  }

  await ensureOutputDir();

  const browser = await getBrowser();
  const searchPage = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
  });

  try {
    await searchPage.goto(buildSearchUrl(trimmedKeyword), {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });

    const topResults = await collectSearchResults(searchPage);

    if (topResults.length === 0) {
      throw new Error("블로그 검색 결과를 찾지 못했습니다. 네이버 DOM 구조 변경 여부를 확인해 주세요.");
    }

    const details = [];

    for (const item of topResults.slice(0, RESULT_LIMIT)) {
      const page = await browser.newPage();
      try {
        const article = await extractFromBlogPage(page, item.url);
        const finalTitle = article.title || item.title || "제목 없음";
        const finalBody = article.body || item.preview || "";

        details.push({
          rank: details.length + 1,
          sourceUrl: item.url,
          mobileUrl: article.url,
          title: finalTitle,
          body: finalBody,
          keywords: extractKeywords(finalTitle, finalBody)
        });
      } catch (error) {
        details.push({
          rank: details.length + 1,
          sourceUrl: item.url,
          mobileUrl: toMobileBlogUrl(item.url),
          title: item.title || "제목 없음",
          body: item.preview || "",
          keywords: extractKeywords(item.title || "", item.preview || ""),
          error: error.message
        });
      } finally {
        await page.close();
      }
    }

    const payload = {
      searchedKeyword: trimmedKeyword,
      collectedAt: new Date().toISOString(),
      results: details
    };

    if (SHOULD_PERSIST_OUTPUT) {
      const filePath = path.join(OUTPUT_DIR, `${slugify(trimmedKeyword)}.json`);
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
    }

    return payload;
  } finally {
    await searchPage.close();
    await browser.close();
  }
}

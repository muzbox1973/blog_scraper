import { scrapeKeyword } from "./lib/naver-scraper.js";

const keyword = process.argv.slice(2).join(" ").trim();

if (!keyword) {
  console.error('검색 키워드를 입력해 주세요. 예: node scraper.mjs "제주도 맛집"');
  process.exit(1);
}

try {
  const payload = await scrapeKeyword(keyword);
  console.log(JSON.stringify(payload, null, 2));
} catch (error) {
  console.error(`수집 실패: ${error.message}`);
  process.exitCode = 1;
}

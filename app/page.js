"use client";

import { useState } from "react";

const sampleKeywords = ["제주도 맛집", "강남 카페", "아이폰 후기"];

export default function HomePage() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = keyword.trim();

    if (!trimmed) {
      setError("검색할 키워드를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ keyword: trimmed })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "수집 중 오류가 발생했습니다.");
      }

      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Naver Blog Collector</p>
        <h1>키워드 한 번으로 네이버 블로그 상위 3개 글을 수집합니다.</h1>
        <p className="hero-copy">
          네이버 블로그 탭 기준으로 상위 노출 글 3개를 찾아 제목, 본문, 추출 키워드를
          한 번에 확인하세요. Vercel 배포를 고려한 서버형 웹앱 구조입니다.
        </p>

        <form className="search-form" onSubmit={handleSubmit}>
          <label className="input-label" htmlFor="keyword">
            검색 키워드
          </label>
          <div className="input-row">
            <input
              id="keyword"
              className="keyword-input"
              placeholder="예: 제주도 맛집"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <button className="submit-button" type="submit" disabled={loading}>
              {loading ? "수집 중..." : "수집 시작"}
            </button>
          </div>
        </form>

        <div className="sample-row">
          {sampleKeywords.map((sample) => (
            <button
              key={sample}
              type="button"
              className="sample-chip"
              onClick={() => setKeyword(sample)}
            >
              {sample}
            </button>
          ))}
        </div>

        {error ? <p className="message error">{error}</p> : null}
      </section>

      {result ? (
        <section className="results-panel">
          <div className="results-header">
            <div>
              <p className="eyebrow">Collected Result</p>
              <h2>{result.searchedKeyword}</h2>
            </div>
            <p className="timestamp">
              수집 시각: {new Date(result.collectedAt).toLocaleString("ko-KR")}
            </p>
          </div>

          <div className="result-grid">
            {result.results.map((item) => (
              <article key={item.rank} className="result-card">
                <div className="card-top">
                  <span className="rank-badge">TOP {item.rank}</span>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    원문 보기
                  </a>
                </div>

                <h3>{item.title}</h3>
                <p className="body-text">{item.body || "본문을 가져오지 못했습니다."}</p>

                <div className="keyword-wrap">
                  {item.keywords.map((tag) => (
                    <span key={`${item.rank}-${tag.keyword}`} className="keyword-chip">
                      #{tag.keyword} <strong>{tag.count}</strong>
                    </span>
                  ))}
                </div>

                {item.error ? <p className="message warning">{item.error}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="empty-panel">
          <p>검색 후 결과가 여기에 표시됩니다.</p>
        </section>
      )}
    </main>
  );
}

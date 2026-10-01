"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http";
import type { RequestItem } from "@/lib/types";

type Filter = "all" | RequestItem["category"];

export default function RequestHistory({ requests }: { requests: RequestItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [visitors, setVisitors] = useState<RequestItem[]>([]);
  const [loadingVisitors, setLoadingVisitors] = useState(true);
  const [visitorError, setVisitorError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ data?: RequestItem[] }>("/api/history?category=visitors", { signal: controller.signal }, "방문예약 내역을 불러오지 못했습니다.")
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.data) throw new Error("방문예약 내역을 불러오지 못했습니다.");
        setVisitors(result.data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setVisitorError(error instanceof Error ? error.message : "방문예약 내역을 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingVisitors(false); });
    return () => controller.abort();
  }, [retry]);
  const combined = [...requests, ...visitors].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = filter === "all" ? combined : combined.filter((item) => item.category === filter);
  const waitingForVisitors = loadingVisitors && (filter === "all" || filter === "visitors");
  const showEmpty = filtered.length === 0 && !waitingForVisitors && !(visitorError && filter === "visitors");
  const filters: Array<[Filter, string]> = [["all", "전체"], ["flexible", "유연근무"], ["overtime", "잔업"], ["leave", "연차"], ["visitors", "방문예약"]];

  return (
    <section className="panel history-panel">
      <h2>내 신청내역</h2>
      <div className="filter-row" role="group" aria-label="신청내역 유형 필터">
        {filters.map(([value, label]) => (
          <button className={filter === value ? "active" : ""} key={value} type="button" onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      {filter === "visitors" && <p className="history-helper">내가 담당자로 지정된 방문예약입니다.</p>}
      {(filter === "all" || filter === "visitors") && loadingVisitors && <p className="empty-text" role="status">방문예약 내역 불러오는 중…</p>}
      {(filter === "all" || filter === "visitors") && visitorError && <div className="history-load-error" role="alert">{visitorError} <button type="button" onClick={() => { setVisitorError(""); setLoadingVisitors(true); setRetry((value) => value + 1); }}>다시 시도</button></div>}
      <div className="history-list">
        {showEmpty && <p className="empty-text">신청내역이 없습니다.</p>}
        {filtered.map((item) => (
          <article className={`history-item ${item.category}`} key={`${item.category}-${item.id}`}>
            <div>
              <span className="type-badge">{item.typeLabel}</span>
              <time>{item.dateLabel}</time>
            </div>
            <strong>{item.detail || "상세내용 없음"}</strong>
            {(item.status || item.requestNo) && <footer className="history-meta">
              {item.status && <span className={item.status === "예약취소" ? "history-cancelled" : ""}>{item.status}</span>}
              {item.requestNo && <small>{item.requestNo}</small>}
            </footer>}
          </article>
        ))}
      </div>
    </section>
  );
}

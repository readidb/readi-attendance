"use client";

import { useState } from "react";
import type { RequestItem } from "@/lib/types";

type Filter = "all" | RequestItem["category"];

export default function RequestHistory({ requests }: { requests: RequestItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = filter === "all" ? requests : requests.filter((item) => item.category === filter);
  const filters: Array<[Filter, string]> = [["all", "전체"], ["flexible", "유연근무"], ["overtime", "잔업"], ["leave", "연차"]];

  return (
    <section className="panel history-panel">
      <h2>내 신청내역</h2>
      <div className="filter-row" role="group" aria-label="신청내역 유형 필터">
        {filters.map(([value, label]) => (
          <button className={filter === value ? "active" : ""} key={value} type="button" onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      <div className="history-list">
        {filtered.length === 0 ? <p className="empty-text">신청내역이 없습니다.</p> : filtered.map((item) => (
          <article className={`history-item ${item.category}`} key={`${item.category}-${item.id}`}>
            <div>
              <span className="type-badge">{item.typeLabel}</span>
              <time>{item.dateLabel}</time>
            </div>
            <strong>{item.detail || "상세내용 없음"}</strong>
            {item.status && <p>{item.status}</p>}
            <small>{item.requestNo}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

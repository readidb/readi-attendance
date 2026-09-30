"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import type { VisitorData, VisitorHost, VisitorReservation } from "@/lib/types";

type View = "calendar" | "list" | "form";
type DateFilter = "all" | "today" | "upcoming";

type Draft = {
  visitDate: string;
  visitTime: string;
  location: string;
  hostRecordId: string;
  company: string;
  vehicleNo: string;
  headcount: number;
  purpose: string;
  note: string;
};

const LOCATIONS = ["1공장", "2공장", "연구소"];

function blankDraft(today: string, hostRecordId = ""): Draft {
  return {
    visitDate: today,
    visitTime: "10:00",
    location: "1공장",
    hostRecordId,
    company: "",
    vehicleNo: "",
    headcount: 1,
    purpose: "",
    note: "",
  };
}

function reservationDraft(item: VisitorReservation): Draft {
  return {
    visitDate: item.visitDate,
    visitTime: item.visitTime,
    location: item.location,
    hostRecordId: item.hostRecordId,
    company: item.company,
    vehicleNo: item.vehicleNo,
    headcount: item.headcount || 1,
    purpose: item.purpose,
    note: item.note,
  };
}

function monthTitle(value: string): string {
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
}

function moveMonth(value: string, amount: number): string {
  const [year, month] = value.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarDays(month: string): Array<string | null> {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const last = new Date(Date.UTC(year, monthNumber, 0));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const days: Array<string | null> = Array.from({ length: mondayOffset }, () => null);
  for (let day = 1; day <= last.getUTCDate(); day += 1) {
    days.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (days.length % 7) days.push(null);
  return days;
}

async function fetchVisitorData(): Promise<VisitorData> {
  const response = await fetch("/api/visitors", { cache: "no-store" });
  const result = await response.json() as { data?: VisitorData; message?: string };
  if (!response.ok || !result.data) throw new Error(result.message || "방문 예약을 불러오지 못했습니다.");
  return result.data;
}

function ReservationCard({ item, onOpen }: { item: VisitorReservation; onOpen: () => void }) {
  return (
    <button className="visitor-list-item" type="button" onClick={onOpen}>
      <span className="visitor-list-time">{item.visitDate} {item.visitTime}</span>
      <strong>{item.company}</strong>
      <span>{item.purpose}</span>
      <small>{item.location} · {item.hostName || "담당자 미지정"} · {item.headcount || 1}명</small>
    </button>
  );
}

export default function VisitorManager({
  today,
  onNotify,
}: {
  today: string;
  onNotify: (message: string) => void;
}) {
  const [data, setData] = useState<VisitorData | null>(null);
  const [view, setView] = useState<View>("calendar");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<VisitorReservation | null>(null);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Draft>(() => blankDraft(today));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchVisitorData();
      setData(result);
      setDraft((current) => current.hostRecordId
        ? current
        : { ...current, hostRecordId: result.currentHostRecordId || "" });
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "방문 예약을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    let active = true;
    void fetchVisitorData()
      .then((result) => {
        if (!active) return;
        setData(result);
        setDraft((current) => current.hostRecordId
          ? current
          : { ...current, hostRecordId: result.currentHostRecordId || "" });
      })
      .catch((error: unknown) => {
        if (active) onNotify(error instanceof Error ? error.message : "방문 예약을 불러오지 못했습니다.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onNotify]);

  const reservations = useMemo(() => data?.reservations || [], [data]);
  const byDate = useMemo(() => {
    const map = new Map<string, VisitorReservation[]>();
    reservations.forEach((item) => map.set(item.visitDate, [...(map.get(item.visitDate) || []), item]));
    return map;
  }, [reservations]);
  const listItems = useMemo(() => reservations.filter((item) => {
    if (dateFilter === "today") return item.visitDate === today;
    if (dateFilter === "upcoming") return item.visitDate >= today;
    return true;
  }), [dateFilter, reservations, today]);

  function beginCreate(date = today) {
    setSelected(null);
    setEditingId("");
    setDraft(blankDraft(date, data?.currentHostRecordId || ""));
    setView("form");
  }

  function beginEdit(item: VisitorReservation) {
    setSelected(null);
    setEditingId(item.id);
    setDraft(reservationDraft(item));
    setView("form");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/visitors", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: editingId || undefined }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "방문 예약을 저장하지 못했습니다.");
      onNotify(result.message || "방문 예약이 저장되었습니다.");
      await load();
      setView("list");
      setEditingId("");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "방문 예약을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel visitor-panel">
      <div className="visitor-heading">
        <div><h2>방문 예약 관리</h2><p className="helper">예약 등록·조회·수정</p></div>
        {view !== "form" && <button className="compact-primary" type="button" onClick={() => beginCreate()}>예약 등록</button>}
      </div>

      {view !== "form" && (
        <div className="visitor-view-tabs" aria-label="예약 보기 방식">
          <button className={view === "calendar" ? "active" : ""} type="button" onClick={() => { setView("calendar"); setSelected(null); }}>달력</button>
          <button className={view === "list" ? "active" : ""} type="button" onClick={() => { setView("list"); setSelected(null); }}>목록</button>
        </div>
      )}

      {loading && <div className="visitor-loading"><div className="spinner" aria-label="방문 예약 불러오는 중" /></div>}

      {!loading && view === "calendar" && (
        <div className="visitor-calendar-wrap">
          <div className="calendar-heading">
            <button type="button" aria-label="이전 달" onClick={() => setMonth((value) => moveMonth(value, -1))}>‹</button>
            <strong>{monthTitle(month)}</strong>
            <button type="button" aria-label="다음 달" onClick={() => setMonth((value) => moveMonth(value, 1))}>›</button>
          </div>
          <div className="calendar-weekdays">{["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {calendarDays(month).map((date, index) => date ? (
              <button className={`${date === selectedDate ? "selected" : ""} ${date === today ? "today" : ""}`} key={date} type="button" onClick={() => { setSelectedDate(date); setSelected(null); }}>
                <span>{Number(date.slice(-2))}</span>
                {(byDate.get(date)?.length || 0) > 0 && <b>{byDate.get(date)?.length}</b>}
              </button>
            ) : <span className="calendar-empty" key={`empty-${index}`} />)}
          </div>
          <div className="selected-date-heading">
            <strong>{selectedDate}</strong>
            <button type="button" onClick={() => beginCreate(selectedDate)}>이 날짜에 등록</button>
          </div>
          <div className="visitor-list">
            {(byDate.get(selectedDate) || []).map((item) => <ReservationCard key={item.id} item={item} onOpen={() => setSelected(item)} />)}
            {(byDate.get(selectedDate) || []).length === 0 && <p className="empty-text">이 날짜의 예약이 없습니다.</p>}
          </div>
        </div>
      )}

      {!loading && view === "list" && (
        <>
          <div className="visitor-filters">
            {(["upcoming", "today", "all"] as DateFilter[]).map((value) => (
              <button className={dateFilter === value ? "active" : ""} key={value} type="button" onClick={() => setDateFilter(value)}>
                {{ upcoming: "예정", today: "오늘", all: "전체" }[value]}
              </button>
            ))}
          </div>
          <div className="visitor-list">
            {listItems.map((item) => <ReservationCard key={item.id} item={item} onOpen={() => setSelected(item)} />)}
            {listItems.length === 0 && <p className="empty-text">조건에 맞는 예약이 없습니다.</p>}
          </div>
        </>
      )}

      {!loading && view === "form" && (
        <form className="visitor-form" onSubmit={save}>
          <div className="visitor-form-title">
            <h3>{editingId ? "예약 수정" : "예약 등록"}</h3>
            <button type="button" onClick={() => { setView("list"); setEditingId(""); }}>닫기</button>
          </div>
          <div className="form-two-columns">
            <label>방문일자<input type="date" value={draft.visitDate} onChange={(event) => setDraft({ ...draft, visitDate: event.target.value })} required /></label>
            <label>방문시간<input type="time" value={draft.visitTime} onChange={(event) => setDraft({ ...draft, visitTime: event.target.value })} required /></label>
          </div>
          <label>방문장소
            <select value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} required>
              {LOCATIONS.map((location) => <option key={location}>{location}</option>)}
            </select>
          </label>
          <label>방문업체<input value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} maxLength={150} required /></label>
          <label>방문인원<input type="number" min="1" max="100" value={draft.headcount} onChange={(event) => setDraft({ ...draft, headcount: Number(event.target.value) })} required /></label>
          <label>방문목적<textarea value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} maxLength={500} required /></label>
          <label>담당자
            <select value={draft.hostRecordId} onChange={(event) => setDraft({ ...draft, hostRecordId: event.target.value })} required>
              <option value="">담당자 선택</option>
              {(data?.hosts || []).map((host: VisitorHost) => <option key={host.recordId} value={host.recordId}>{host.name} {host.position} · {host.department}</option>)}
            </select>
          </label>
          <label>연락처<input value={(data?.hosts || []).find((host) => host.recordId === draft.hostRecordId)?.phone || ""} readOnly placeholder="담당자 정보에서 자동 표시" /></label>
          <label>차량번호<input value={draft.vehicleNo} onChange={(event) => setDraft({ ...draft, vehicleNo: event.target.value })} maxLength={50} /></label>
          <label>비고<textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} maxLength={300} /></label>
          <LoadingButton className="primary-button" type="submit" loading={saving}>{editingId ? "수정 저장" : "예약 등록"}</LoadingButton>
        </form>
      )}

      {selected && (
        <div className="visitor-detail-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <article className="visitor-detail" role="dialog" aria-modal="true" aria-label="방문 예약 상세" onClick={(event) => event.stopPropagation()}>
            <div className="visitor-form-title"><h3>예약 상세</h3><button type="button" onClick={() => setSelected(null)}>닫기</button></div>
            <dl>
              <div><dt>예약번호</dt><dd>{selected.reservationNo || "-"}</dd></div>
              <div><dt>방문일시</dt><dd>{selected.visitDate} {selected.visitTime}</dd></div>
              <div><dt>업체</dt><dd>{selected.company}</dd></div>
              <div><dt>방문인원</dt><dd>{selected.headcount || 1}명</dd></div>
              <div><dt>방문목적</dt><dd>{selected.purpose}</dd></div>
              <div><dt>담당자</dt><dd>{selected.hostName || "-"}</dd></div>
              <div><dt>연락처</dt><dd>{selected.hostPhone || "-"}</dd></div>
              <div><dt>장소</dt><dd>{selected.location || "-"}</dd></div>
              <div><dt>차량번호</dt><dd>{selected.vehicleNo || "-"}</dd></div>
              <div><dt>비고</dt><dd>{selected.note || "-"}</dd></div>
            </dl>
            <button className="primary-button" type="button" onClick={() => beginEdit(selected)}>예약 수정</button>
          </article>
        </div>
      )}
    </section>
  );
}

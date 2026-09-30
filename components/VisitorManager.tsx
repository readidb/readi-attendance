"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import type { VisitorData, VisitorHost, VisitorReservation } from "@/lib/types";

type View = "overview" | "form";
type DateFilter = "all" | "today" | "upcoming";

type Draft = {
  visitDate: string;
  visitTime: string;
  location: string;
  hostRecordIds: string[];
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
    hostRecordIds: hostRecordId ? [hostRecordId] : [],
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
    hostRecordIds: item.hostRecordIds,
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

function hostLabel(host: VisitorHost): string {
  return `${host.name} ${host.position} · ${host.department}`;
}

function HostPicker({
  hosts,
  selectedIds,
  onChange,
}: {
  hosts: VisitorHost[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedHosts = hosts.filter((host) => selectedIds.includes(host.recordId));
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  const filteredHosts = hosts.filter((host) => !normalized || hostLabel(host).toLocaleLowerCase("ko-KR").includes(normalized));

  function toggle(hostId: string) {
    onChange(selectedIds.includes(hostId)
      ? selectedIds.filter((id) => id !== hostId)
      : [...selectedIds, hostId]);
    setQuery("");
  }

  return (
    <div className="host-picker" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      {selectedHosts.length > 0 && (
        <div className="host-chips" aria-label="선택된 담당자">
          {selectedHosts.map((host) => (
            <span key={host.recordId}>
              {host.name}
              <button type="button" aria-label={`${host.name} 담당자 제외`} onClick={() => toggle(host.recordId)}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="host-combobox">
        <input
          role="combobox"
          aria-label="담당자 검색"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="visitor-host-options"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder="담당자 이름·부서 검색"
        />
        <button className="host-picker-toggle" type="button" aria-label="담당자 목록 열기" onClick={() => setOpen((value) => !value)}>⌄</button>
        {open && (
          <div className="host-options" id="visitor-host-options" role="listbox" aria-multiselectable="true">
            {filteredHosts.map((host) => {
              const checked = selectedIds.includes(host.recordId);
              return (
                <button
                  className={checked ? "selected" : ""}
                  key={host.recordId}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(host.recordId)}
                >
                  <span>{hostLabel(host)}</span><b>{checked ? "✓" : "+"}</b>
                </button>
              );
            })}
            {filteredHosts.length === 0 && <p>검색 결과가 없습니다.</p>}
          </div>
        )}
      </div>
      {selectedIds.length === 0 && <span className="field-error">담당자를 1명 이상 선택해 주세요.</span>}
    </div>
  );
}

function ReservationCard({ item, onOpen }: { item: VisitorReservation; onOpen: () => void }) {
  return (
    <button className={`visitor-list-item${item.cancelled ? " cancelled" : ""}`} type="button" onClick={onOpen}>
      <span className="visitor-list-time">방문일시 · {item.visitDate} {item.visitTime}</span>
      <span className="visitor-card-group">
        <span className="visitor-card-heading">방문자</span>
        <span className="visitor-card-row"><span className="visitor-card-label">방문업체</span><strong className="visitor-card-value">{item.company || "-"}</strong></span>
        <span className="visitor-card-row"><span className="visitor-card-label">방문목적</span><span className="visitor-card-value">{item.purpose || "-"}</span></span>
        <span className="visitor-card-row"><span className="visitor-card-label">방문인원</span><span className="visitor-card-value">{item.headcount || 1}명</span></span>
        {item.vehicleNo && <span className="visitor-card-row"><span className="visitor-card-label">차량번호</span><span className="visitor-card-value">{item.vehicleNo}</span></span>}
        {item.note && <span className="visitor-card-row"><span className="visitor-card-label">비고</span><span className="visitor-card-value">{item.note}</span></span>}
      </span>
      <span className="visitor-card-group">
        <span className="visitor-card-heading">방문장소</span>
        <span className="visitor-card-row"><span className="visitor-card-label">장소</span><span className="visitor-card-value">{item.location || "-"}</span></span>
      </span>
      <span className="visitor-card-group">
        <span className="visitor-card-heading">담당자</span>
        <span className="visitor-card-row"><span className="visitor-card-label">담당자</span><span className="visitor-card-value">{item.hostNames.join(", ") || "미지정"}</span></span>
      </span>
      {item.cancelled && <em className="visitor-cancel-badge">예약취소</em>}
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
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
      setDraft((current) => current.hostRecordIds.length
        ? current
        : { ...current, hostRecordIds: result.currentHostRecordId ? [result.currentHostRecordId] : [] });
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
        setDraft((current) => current.hostRecordIds.length
          ? current
          : { ...current, hostRecordIds: result.currentHostRecordId ? [result.currentHostRecordId] : [] });
      })
      .catch((error: unknown) => {
        if (active) onNotify(error instanceof Error ? error.message : "방문 예약을 불러오지 못했습니다.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onNotify]);

  const reservations = useMemo(() => data?.reservations || [], [data]);
  const activeReservations = useMemo(() => reservations.filter((item) => !item.cancelled), [reservations]);
  const byDate = useMemo(() => {
    const map = new Map<string, VisitorReservation[]>();
    activeReservations.forEach((item) => map.set(item.visitDate, [...(map.get(item.visitDate) || []), item]));
    return map;
  }, [activeReservations]);
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
    if (saving || draft.hostRecordIds.length === 0) return;
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
      setView("overview");
      setEditingId("");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "방문 예약을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelReservation(item: VisitorReservation) {
    if (cancelling || !window.confirm("예약을 취소하시겠습니까? 취소된 예약은 목록에서 계속 확인할 수 있습니다.")) return;
    setCancelling(true);
    try {
      const response = await fetch("/api/visitors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "cancel" }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "예약을 취소하지 못했습니다.");
      onNotify(result.message || "방문 예약이 취소되었습니다.");
      setSelected(null);
      await load();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "예약을 취소하지 못했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  const selectedHosts = (data?.hosts || []).filter((host) => draft.hostRecordIds.includes(host.recordId));

  return (
    <section className="panel visitor-panel">
      <div className="visitor-heading">
        <div><h2>방문 예약 관리</h2><p className="helper">예약 등록·조회·수정·취소</p></div>
        {view === "overview" && <button className="compact-primary" type="button" onClick={() => beginCreate()}>예약 등록</button>}
      </div>

      {loading && <div className="visitor-loading"><div className="spinner" aria-label="방문 예약 불러오는 중" /></div>}

      {!loading && view === "overview" && (
        <div className="visitor-overview">
          <section className="visitor-section" aria-labelledby="visitor-calendar-title">
            <div className="visitor-section-heading"><h3 id="visitor-calendar-title">달력</h3><span>예약이 있는 날짜를 선택하세요.</span></div>
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
            <div className="selected-date-heading"><strong>{selectedDate}</strong></div>
            <div className="visitor-list compact">
              {(byDate.get(selectedDate) || []).map((item) => <ReservationCard key={item.id} item={item} onOpen={() => setSelected(item)} />)}
              {(byDate.get(selectedDate) || []).length === 0 && <p className="empty-text">이 날짜의 예약이 없습니다.</p>}
            </div>
          </section>

          <section className="visitor-section" aria-labelledby="visitor-list-title">
            <div className="visitor-section-heading"><h3 id="visitor-list-title">예약 목록</h3><span>취소된 예약도 목록에 표시됩니다.</span></div>
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
          </section>
        </div>
      )}

      {!loading && view === "form" && (
        <form className="visitor-form" onSubmit={save}>
          <div className="visitor-form-title">
            <h3>{editingId ? "예약 수정" : "예약 등록"}</h3>
            <button type="button" onClick={() => { setView("overview"); setEditingId(""); }}>닫기</button>
          </div>

          <fieldset className="visitor-form-group">
            <legend>방문자 정보</legend>
            <div className="form-two-columns">
              <label>방문일자<input type="date" value={draft.visitDate} onChange={(event) => setDraft({ ...draft, visitDate: event.target.value })} required /></label>
              <label>방문시간<input type="time" value={draft.visitTime} onChange={(event) => setDraft({ ...draft, visitTime: event.target.value })} required /></label>
            </div>
            <label>방문장소
              <input list="visitor-location-options" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="선택하거나 직접 입력" required />
              <datalist id="visitor-location-options">{LOCATIONS.map((location) => <option key={location} value={location} />)}</datalist>
            </label>
            <label>방문업체<input value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} maxLength={150} required /></label>
            <label>방문인원<input type="number" min="1" max="100" value={draft.headcount} onChange={(event) => setDraft({ ...draft, headcount: Number(event.target.value) })} required /></label>
            <label>방문목적<textarea value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} maxLength={500} required /></label>
            <label>차량번호<input value={draft.vehicleNo} onChange={(event) => setDraft({ ...draft, vehicleNo: event.target.value })} maxLength={50} /></label>
            <label>비고<textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} maxLength={300} placeholder="필요시 방문자명 등 입력하시기 바랍니다" /></label>
          </fieldset>

          <fieldset className="visitor-form-group">
            <legend>담당자 정보</legend>
            <label>담당자
              <HostPicker hosts={data?.hosts || []} selectedIds={draft.hostRecordIds} onChange={(hostRecordIds) => setDraft({ ...draft, hostRecordIds })} />
            </label>
            <div className="selected-host-contacts">
              {selectedHosts.map((host) => (
                <div key={host.recordId}><strong>{host.name} {host.position}</strong><span>{host.department} · {host.phone || "연락처 없음"}</span></div>
              ))}
            </div>
          </fieldset>

          <LoadingButton className="primary-button" type="submit" loading={saving}>{editingId ? "수정 저장" : "예약 등록"}</LoadingButton>
        </form>
      )}

      {selected && (
        <div className="visitor-detail-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <article className="visitor-detail" role="dialog" aria-modal="true" aria-label="방문 예약 상세" onClick={(event) => event.stopPropagation()}>
            <div className="visitor-form-title"><h3>예약 상세</h3><button type="button" onClick={() => setSelected(null)}>닫기</button></div>
            {selected.cancelled && <p className="visitor-cancel-notice">취소된 예약입니다.</p>}
            <dl>
              <div><dt>예약번호</dt><dd>{selected.reservationNo || "-"}</dd></div>
              <div><dt>방문일시</dt><dd>{selected.visitDate} {selected.visitTime}</dd></div>
              <div><dt>업체</dt><dd>{selected.company}</dd></div>
              <div><dt>방문인원</dt><dd>{selected.headcount || 1}명</dd></div>
              <div><dt>방문목적</dt><dd>{selected.purpose}</dd></div>
              <div><dt>담당자</dt><dd>{selected.hostNames.join(", ") || "-"}</dd></div>
              <div><dt>연락처</dt><dd>{selected.hostPhones.join(", ") || "-"}</dd></div>
              <div><dt>장소</dt><dd>{selected.location || "-"}</dd></div>
              <div><dt>차량번호</dt><dd>{selected.vehicleNo || "-"}</dd></div>
              <div><dt>비고</dt><dd>{selected.note || "-"}</dd></div>
            </dl>
            {!selected.cancelled && (
              <div className="visitor-detail-actions">
                <button className="primary-button" type="button" onClick={() => beginEdit(selected)}>예약 수정</button>
                <button className="danger-button" type="button" disabled={cancelling} onClick={() => void cancelReservation(selected)}>{cancelling ? "취소 처리 중" : "예약 취소"}</button>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

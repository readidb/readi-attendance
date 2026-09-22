"use client";

import { useEffect, useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import { STANDARD_SCHEDULE } from "@/lib/constants";
import { calculateOvertimeHours } from "@/lib/dates";

type Props = {
  today: string;
  weeklyOvertime: number;
  onSuccess: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function OvertimeForm({ today, weeklyOvertime, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [date, setDate] = useState(today);
  const [schedule, setSchedule] = useState(STANDARD_SCHEDULE);
  const [dateWeeklyOvertime, setDateWeeklyOvertime] = useState(weeklyOvertime);
  const [endTime, setEndTime] = useState("18:00");
  const [meal, setMeal] = useState(false);
  const [reason, setReason] = useState("");
  const hours = calculateOvertimeHours(schedule, endTime, meal);
  const afterTotal = dateWeeklyOvertime + hours;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/overtime?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { schedule?: string; weeklyOvertime?: number; message?: string };
        if (!response.ok || !result.schedule) throw new Error(result.message || "근무시간을 불러오지 못했습니다.");
        setSchedule(result.schedule);
        setDateWeeklyOvertime(Number(result.weeklyOvertime ?? 0));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        onError(error instanceof Error ? error.message : "근무시간을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setContextLoading(false);
      });
    return () => controller.abort();
  }, [date, onError]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, endTime, meal, reason }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "신청을 등록하지 못했습니다.");
      setReason("");
      await onSuccess(result.message || "잔업 신청이 등록되었습니다.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "신청을 등록하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel form-panel">
      <h2>잔업 신청</h2>
      <p className="helper">식사 체크 시 1시간을 차감하고, 잔업은 1시간 단위로 계산합니다.</p>
      <form onSubmit={submit}>
        <label>날짜<input type="date" value={date} onChange={(event) => { setContextLoading(true); setDate(event.target.value); }} required /></label>
        <label>적용 근무시간<input value={contextLoading ? "불러오는 중" : schedule} readOnly aria-busy={contextLoading} /></label>
        <label>퇴근시간<input type="time" step="1800" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
        <label className="checkbox-label">
          <input type="checkbox" checked={meal} onChange={(event) => setMeal(event.target.checked)} />
          식사여부
        </label>
        <label>장소/사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="예: 2공장 / 장비 출하 준비" required /></label>
        <div className={`calculation-box ${afterTotal > 12 ? "over" : ""}`}>
          <div className="calculation-stat"><span>신청 잔업</span><strong>{hours}<small>h</small></strong></div>
          <div className="calculation-stat"><span>신청 후 잔여</span><strong>{Math.max(0, 12 - afterTotal)}<small>h</small></strong></div>
          {afterTotal > 12 && <p>주간 잔업 가능시간을 초과하여 신청할 수 없습니다.</p>}
        </div>
        <LoadingButton className="primary-button" type="submit" loading={loading} disabled={contextLoading || hours < 1 || afterTotal > 12}>잔업 신청</LoadingButton>
      </form>
    </section>
  );
}

"use client";

import { useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import { FLEXIBLE_SCHEDULES } from "@/lib/constants";
import { calculateOvertimeHours } from "@/lib/dates";

type Props = {
  today: string;
  weeklyOvertime: number;
  onSuccess: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function OvertimeForm({ today, weeklyOvertime, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(today);
  const [schedule, setSchedule] = useState("08:00 ~ 17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [meal, setMeal] = useState(false);
  const [reason, setReason] = useState("");
  const hours = calculateOvertimeHours(schedule, endTime, meal);
  const afterTotal = weeklyOvertime + hours;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, schedule, endTime, meal, reason }),
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
        <label>날짜<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label>유연근무 유형
          <select value={schedule} onChange={(event) => setSchedule(event.target.value)} required>
            {FLEXIBLE_SCHEDULES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>퇴근시간<input type="time" step="1800" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
        <label className="checkbox-label">
          <input type="checkbox" checked={meal} onChange={(event) => setMeal(event.target.checked)} />
          식사여부
        </label>
        <label>장소/사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="예: 2공장 / 장비 출하 준비" required /></label>
        <div className={`calculation-box ${afterTotal > 12 ? "over" : ""}`}>
          <span>신청 잔업</span><strong>{hours}h</strong>
          <span>신청 후 금주 합계</span><strong>{afterTotal}h / 12h</strong>
          {afterTotal > 12 && <p>주간 잔업 가능시간을 초과하여 신청할 수 없습니다.</p>}
        </div>
        <LoadingButton className="primary-button" type="submit" loading={loading} disabled={hours < 1 || afterTotal > 12}>잔업 신청</LoadingButton>
      </form>
    </section>
  );
}

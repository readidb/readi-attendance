"use client";

import { useEffect, useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import { useSubmission } from "@/components/useSubmission";
import { requestJson } from "@/lib/http";
import { FLEXIBLE_SCHEDULES, STANDARD_SCHEDULE } from "@/lib/constants";
import { calculateOvertimeHours } from "@/lib/dates";

type Props = {
  today: string;
  weeklyOvertime: number;
  onSuccess: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function OvertimeForm({ today, weeklyOvertime, onSuccess, onError }: Props) {
  const { loading, run } = useSubmission(onError);
  const [contextLoading, setContextLoading] = useState(true);
  const [date, setDate] = useState(today);
  const [schedule, setSchedule] = useState(STANDARD_SCHEDULE);
  const [dateWeeklyOvertime, setDateWeeklyOvertime] = useState(weeklyOvertime);
  const [endTime, setEndTime] = useState("18:00");
  const [internalMeal, setInternalMeal] = useState(false);
  const [externalMeal, setExternalMeal] = useState(false);
  const [reason, setReason] = useState("");
  const hours = calculateOvertimeHours(schedule, endTime, externalMeal, internalMeal);
  const afterTotal = dateWeeklyOvertime + hours;

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ schedule?: string; weeklyOvertime?: number; message?: string }>(`/api/overtime?date=${encodeURIComponent(date)}`, { signal: controller.signal }, "근무시간을 불러오지 못했습니다.")
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.schedule || !FLEXIBLE_SCHEDULES.some((item) => item === result.schedule)) throw new Error("근무시간을 불러오지 못했습니다.");
        setSchedule(result.schedule);
        setDateWeeklyOvertime(Number(result.weeklyOvertime ?? 0));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        onError(error instanceof Error ? error.message : "근무시간을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setContextLoading(false);
      });
    return () => controller.abort();
  }, [date, onError]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (contextLoading) return;
    await run(async () => {
      const result = await requestJson<{ message?: string }>("/api/overtime", {
        method: "POST",
        body: JSON.stringify({ date, schedule, endTime, internalMeal, externalMeal, reason }),
      }, "신청을 등록하지 못했습니다.");
      setReason("");
      await onSuccess(result.message || "잔업 신청이 등록되었습니다.");
    });
  }

  return (
    <section className="panel form-panel">
      <h2>잔업 신청</h2>
      <p className="helper">잔업을 1시간 단위로 내림한 뒤 사내식사는 0.5시간, 외부식사는 1시간을 차감합니다.</p>
      <form onSubmit={submit}>
        <label>날짜<input type="date" value={date} onChange={(event) => { setContextLoading(true); setSchedule(STANDARD_SCHEDULE); setDate(event.target.value); }} required /></label>
        <label>출근시간
          <select value={schedule} onChange={(event) => setSchedule(event.target.value)} disabled={contextLoading} aria-busy={contextLoading} required>
            {FLEXIBLE_SCHEDULES.map((item) => <option key={item} value={item}>{item.slice(0, 5)}</option>)}
          </select>
        </label>
        <p className="helper">{contextLoading ? "해당 날짜의 유연근무 시간을 확인하고 있습니다." : "해당 날짜의 유연근무 출근시간이 기본값입니다. 신청이 없으면 08:00이며 직접 변경할 수 있습니다."}</p>
        <label>퇴근시간<input type="time" step="1800" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
        <fieldset className="meal-options">
          <legend>식사 종류</legend>
          <div className="meal-option-row">
            <label className="checkbox-label">
              <input type="checkbox" checked={internalMeal} onChange={(event) => setInternalMeal(event.target.checked)} />
              사내식사
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={externalMeal} onChange={(event) => setExternalMeal(event.target.checked)} />
              외부식사
            </label>
          </div>
        </fieldset>
        <label>장소/사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="예: 2공장 / 장비 출하 준비" required /></label>
        <div className={`calculation-box ${afterTotal > 12 ? "over" : ""}`}>
          <div className="calculation-stat"><span>신청 잔업</span><strong>{hours}<small>h</small></strong></div>
          <div className="calculation-stat"><span>신청 후 잔여</span><strong>{Math.max(0, 12 - afterTotal)}<small>h</small></strong></div>
          {afterTotal > 12 && <p>주간 잔업 가능시간을 초과하여 신청할 수 없습니다.</p>}
        </div>
        <LoadingButton className="primary-button" type="submit" loading={loading} disabled={contextLoading || hours <= 0 || afterTotal > 12}>잔업 신청</LoadingButton>
      </form>
    </section>
  );
}

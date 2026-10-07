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
  const [weekendHoliday, setWeekendHoliday] = useState(false);
  const [schedule, setSchedule] = useState(STANDARD_SCHEDULE);
  const [dateWeeklyOvertime, setDateWeeklyOvertime] = useState(weeklyOvertime);
  const [endTime, setEndTime] = useState("18:00");
  const [mealChoice, setMealChoice] = useState<"internal" | "external" | "none" | "">("");
  const [reason, setReason] = useState("");
  const hours = calculateOvertimeHours(schedule, endTime, mealChoice === "external", mealChoice === "internal", weekendHoliday);
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
    if (!mealChoice) return onError("식사 종류를 선택해 주세요.");
    if (!reason.trim()) return onError("장소/사유를 입력해 주세요.");
    await run(async () => {
      const result = await requestJson<{ message?: string }>("/api/overtime", {
        method: "POST",
        body: JSON.stringify({ date, schedule, endTime, mealChoice, weekendHoliday, reason: reason.trim() }),
      }, "신청을 등록하지 못했습니다.");
      setReason("");
      await onSuccess(result.message || "잔업 신청이 등록되었습니다.");
    });
  }

  return (
    <section className="panel form-panel">
      <h2>잔업 신청</h2>
      <p className="helper">잔업정보를 입력해주세요.</p>
      <form onSubmit={submit}>
        <div className="overtime-date-row">
          <label>날짜<input type="date" value={date} onChange={(event) => { setContextLoading(true); setSchedule(STANDARD_SCHEDULE); setDate(event.target.value); }} required /></label>
          <label className="checkbox-label">
            <input type="checkbox" name="weekendHoliday" checked={weekendHoliday} onChange={(event) => setWeekendHoliday(event.target.checked)} />
            주말/공휴일 여부
          </label>
        </div>
        {weekendHoliday && <p className="helper">주말/공휴일은 출근시간부터 잔업시간을 계산합니다.</p>}
        <label>출근시간
          <select value={schedule} onChange={(event) => setSchedule(event.target.value)} disabled={contextLoading} aria-busy={contextLoading} required>
            {FLEXIBLE_SCHEDULES.map((item) => <option key={item} value={item}>{item.slice(0, 5)}</option>)}
          </select>
        </label>
        <p className="helper">{contextLoading ? "해당 날짜의 유연근무 시간을 확인하고 있습니다." : "해당 날짜의 유연근무 출근시간이 기본값입니다. 신청이 없으면 08:00이며 직접 변경할 수 있습니다."}</p>
        <label>퇴근시간<input type="time" step="1800" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
        <fieldset className="meal-options">
          <legend>식사 종류 (필수)</legend>
          <div className="meal-option-row">
            <label className="checkbox-label">
              <input type="radio" name="mealChoice" value="internal" checked={mealChoice === "internal"} onChange={() => setMealChoice("internal")} required />
              사내식사
            </label>
            <label className="checkbox-label">
              <input type="radio" name="mealChoice" value="external" checked={mealChoice === "external"} onChange={() => setMealChoice("external")} required />
              외부식사
            </label>
            <label className="checkbox-label">
              <input type="radio" name="mealChoice" value="none" checked={mealChoice === "none"} onChange={() => setMealChoice("none")} required />
              식사안함
            </label>
          </div>
        </fieldset>
        <label>장소/사유 (필수)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="예: 2공장 / 장비 출하 준비" required /></label>
        <div className={`calculation-box ${afterTotal > 12 ? "over" : ""}`}>
          <div className="calculation-stat"><span>신청 잔업</span><strong>{hours}<small>h</small></strong></div>
          <div className="calculation-stat"><span>신청 후 잔여</span><strong>{12 - afterTotal}<small>h</small></strong></div>
          {afterTotal > 12 && <p>주간 잔업 가능시간을 {afterTotal - 12}시간 초과합니다.</p>}
        </div>
        <LoadingButton className="primary-button" type="submit" loading={loading} disabled={contextLoading || hours <= 0}>잔업 신청</LoadingButton>
      </form>
    </section>
  );
}

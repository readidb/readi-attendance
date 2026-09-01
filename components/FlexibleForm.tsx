"use client";

import { useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import { FLEXIBLE_SCHEDULES } from "@/lib/constants";

type Props = { today: string; onSuccess: (message: string) => Promise<void>; onError: (message: string) => void };

export default function FlexibleForm({ today, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(today);
  const [schedule, setSchedule] = useState("08:00 ~ 17:00");
  const [note, setNote] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/flexible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, schedule, note }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "신청을 등록하지 못했습니다.");
      setNote("");
      await onSuccess(result.message || "유연근무 신청이 등록되었습니다.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "신청을 등록하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel form-panel">
      <h2>유연근무 신청</h2>
      <p className="helper">같은 날짜에는 한 번만 신청할 수 있습니다.</p>
      <form onSubmit={submit}>
        <label>날짜<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label>유연근무 시간
          <select value={schedule} onChange={(event) => setSchedule(event.target.value)} required>
            {FLEXIBLE_SCHEDULES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>비고<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="필요한 경우 입력해 주세요." /></label>
        <LoadingButton className="primary-button" type="submit" loading={loading}>유연근무 신청</LoadingButton>
      </form>
    </section>
  );
}

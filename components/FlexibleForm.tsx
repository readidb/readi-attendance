"use client";

import { useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import { FLEXIBLE_SCHEDULES } from "@/lib/constants";
import { nearestFlexibleSchedule } from "@/lib/dates";

type Props = { today: string; onSuccess: (message: string) => Promise<void>; onError: (message: string) => void };

export default function FlexibleForm({ today, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(today);
  const [schedule, setSchedule] = useState(() => nearestFlexibleSchedule());
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
        <aside className="helper" aria-label="07시 이전 근무 안내">
          <strong>07:00 이전 근무 안내</strong>
          <p>07:00 이전 근무는 근로자의 자율적 선택이 아닌 회사의 지시(출장·외근·근무 등)에 따른 경우에만 인정됩니다.</p>
          <p>신청은 유연근무와 동일하게 진행하고, 출장·외근 계획이 사전 승인된 문서 또는 근무 지시를 확인할 수 있는 Teams 캡처본 등을 BSC에 제출해 주세요.</p>
        </aside>
      </form>
    </section>
  );
}

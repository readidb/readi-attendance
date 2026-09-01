"use client";

import { useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import { LEAVE_TYPES } from "@/lib/constants";
import { countWeekdays } from "@/lib/dates";

type Props = {
  today: string;
  remainingLeave: number;
  onSuccess: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function LeaveForm({ today, remainingLeave, onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("연차");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const days = type === "연차" ? countWeekdays(startDate, endDate) : 0.5;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, startDate, endDate: type === "연차" ? endDate : startDate, reason }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "신청을 등록하지 못했습니다.");
      setReason("");
      await onSuccess(result.message || "연차 신청이 등록되었습니다.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "신청을 등록하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel form-panel">
      <h2>연차 신청</h2>
      <p className="helper">연차는 주말을 제외한 평일 기준으로 계산합니다.</p>
      <form onSubmit={submit}>
        <label>유형
          <select value={type} onChange={(event) => setType(event.target.value)} required>
            {LEAVE_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>시작일<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (type !== "연차") setEndDate(event.target.value); }} required /></label>
        {type === "연차" && <label>종료일<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>}
        <label>사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="연차 사용 사유를 입력해 주세요." required /></label>
        <div className={`calculation-box ${days > remainingLeave ? "over" : ""}`}>
          <span>사용 예정</span><strong>{days}일</strong>
          <span>현재 잔여</span><strong>{remainingLeave}일</strong>
          {days > remainingLeave && <p>잔여 연차가 부족합니다.</p>}
        </div>
        <LoadingButton className="primary-button" type="submit" loading={loading} disabled={days <= 0 || days > remainingLeave}>{type} 신청</LoadingButton>
      </form>
    </section>
  );
}

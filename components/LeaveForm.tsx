"use client";

import { useState } from "react";
import LoadingButton from "@/components/LoadingButton";
import { useSubmission } from "@/components/useSubmission";
import { requestJson } from "@/lib/http";
import { LEAVE_TYPES } from "@/lib/constants";
import { countWeekdays } from "@/lib/dates";

type Props = {
  today: string;
  remainingLeave: number;
  onSuccess: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function LeaveForm({ today, remainingLeave, onSuccess, onError }: Props) {
  const { loading, run } = useSubmission(onError);
  const [type, setType] = useState("연차");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const isRangeType = type === "연차" || type === "리프레시" || type === "공가";
  const deductsLeave = type === "연차" || type === "오전반차" || type === "오후반차";
  const days = isRangeType ? countWeekdays(startDate, endDate) : 0.5;
  const invalidRefresh = type === "리프레시" && days !== 5;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await requestJson<{ message?: string }>("/api/leave", {
        method: "POST",
        body: JSON.stringify({ type, startDate, endDate: isRangeType ? endDate : startDate, reason }),
      }, "신청을 등록하지 못했습니다.");
      setReason("");
      await onSuccess(result.message || "연차 신청이 등록되었습니다.");
    });
  }

  return (
    <section className="panel form-panel">
      <h2>연차 신청</h2>
      <p className="helper">연차·리프레시·공가는 주말을 제외한 평일 기준으로 계산합니다.</p>
      <form onSubmit={submit}>
        <label>유형
          <select value={type} onChange={(event) => setType(event.target.value)} required>
            {LEAVE_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>시작일<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (!isRangeType) setEndDate(event.target.value); }} required /></label>
        {isRangeType && <label>종료일<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>}
        <label>사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="연차 사용 사유를 입력해 주세요." required /></label>
        <div className={`calculation-box ${(deductsLeave && days > remainingLeave) || invalidRefresh ? "over" : ""}`}>
          <div className="calculation-stat"><span>신청 일수</span><strong>{days}<small>일</small></strong></div>
          <div className="calculation-stat"><span>신청 후 잔여</span><strong>{deductsLeave ? Math.max(0, remainingLeave - days) : remainingLeave}<small>일</small></strong></div>
          {!deductsLeave && <p className="calculation-note">{type}는 연차를 차감하지 않습니다.</p>}
          {deductsLeave && days > remainingLeave && <p>잔여 연차가 부족합니다.</p>}
          {invalidRefresh && <p>리프레시는 평일 기준 5일로 신청해 주세요.</p>}
        </div>
        <LoadingButton className="primary-button" type="submit" loading={loading} disabled={days <= 0 || invalidRefresh || (deductsLeave && days > remainingLeave)}>{type} 신청</LoadingButton>
      </form>
    </section>
  );
}

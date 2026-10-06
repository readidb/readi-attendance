"use client";

import { useCallback, useState } from "react";
import VisitorManager from "@/components/VisitorManager";

export default function VisitorCalendar({ today }: { today: string }) {
  const [message, setMessage] = useState("");
  const notify = useCallback((value: string) => setMessage(value), []);

  return (
    <main className="shared-visitor-calendar">
      <header className="shared-visitor-header">
        <h1>READi 방문 예약 캘린더</h1>
        <p>방문 일정을 확인하고 예약을 등록해 주세요.</p>
      </header>
      {message && (
        <div className="shared-visitor-message" role="status" aria-live="polite">
          <span>{message}</span>
          <button type="button" aria-label="알림 닫기" onClick={() => setMessage("")}>닫기</button>
        </div>
      )}
      <VisitorManager today={today} onNotify={notify} shared />
    </main>
  );
}

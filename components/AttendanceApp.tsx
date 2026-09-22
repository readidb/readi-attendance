"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import FlexibleForm from "@/components/FlexibleForm";
import HomeSummary from "@/components/HomeSummary";
import LeaveForm from "@/components/LeaveForm";
import OvertimeForm from "@/components/OvertimeForm";
import RequestHistory from "@/components/RequestHistory";
import type { DashboardData } from "@/lib/types";

type Tab = "home" | "flexible" | "overtime" | "leave" | "history";
const tabs: Array<[Tab, string]> = [["home", "홈"], ["flexible", "유연근무"], ["overtime", "잔업"], ["leave", "연차"], ["history", "내역"]];

export default function AttendanceApp({
  initialData,
  initialError,
  initialToday,
}: {
  initialData: DashboardData | null;
  initialError?: string;
  initialToday: string;
}) {
  const [data, setData] = useState<DashboardData | null>(initialData);
  const [tab, setTab] = useState<Tab>("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || "");
  const [toast, setToast] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const result = await response.json() as { data?: DashboardData; message?: string };
      if (!response.ok || !result.data) throw new Error(result.message || "근태 정보를 불러오지 못했습니다.");
      setData(result.data);
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : "근태 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function completed(message: string) {
    setToast(message);
    setTab("home");
    await refresh();
  }

  if (loading && !data) {
    return <main className="access-page"><div className="spinner" aria-label="근태정보 불러오는 중" /></main>;
  }

  if (!data) {
    return (
      <main className="access-page">
        <section className="access-card">
          <Image src="/readi-logo.png" width={1295} height={391} priority alt="READi Robust Machine" />
          <h1>근태관리 시스템</h1>
          <p>{error || "개인 접속 링크를 통해 접속해 주세요."}</p>
          {!initialError && <button className="primary-button" type="button" onClick={() => void refresh()}>다시 시도</button>}
        </section>
      </main>
    );
  }

  const employee = data.employee;
  return (
    <main className="app-shell">
      <header className="app-header">
        <Image src="/readi-logo.png" width={1295} height={391} priority alt="READi Robust Machine" />
        <button className="refresh-button" type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "불러오는 중" : "새로고침"}</button>
      </header>
      <div className="greeting">
        <p>{employee.department} {employee.name} {employee.position} 님, 안녕하세요.</p>
      </div>

      <div className="page-content">
        {tab === "home" && <HomeSummary data={data} onNavigate={setTab} />}
        {tab === "flexible" && <FlexibleForm today={initialToday} onSuccess={completed} onError={setToast} />}
        {tab === "overtime" && <OvertimeForm today={initialToday} weeklyOvertime={employee.weeklyOvertime} onSuccess={completed} onError={setToast} />}
        {tab === "leave" && <LeaveForm today={initialToday} remainingLeave={employee.remainingLeave} onSuccess={completed} onError={setToast} />}
        {tab === "history" && <RequestHistory requests={data.requests} />}
      </div>

      <nav className="bottom-nav" aria-label="근태 메뉴">
        {tabs.map(([value, label]) => (
          <button className={tab === value ? "active" : ""} key={value} type="button" onClick={() => { setTab(value); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{label}</button>
        ))}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

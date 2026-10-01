import { redirect } from "next/navigation";
import AttendanceApp from "@/components/AttendanceApp";
import { findActiveEmployeeByKey, requireActiveEmployee } from "@/lib/auth";
import { getEmployeeRequests, getPublishedNotices, publicEmployee } from "@/lib/data";
import { todayInSeoul } from "@/lib/dates";
import { getTodayVisitorCount } from "@/lib/visitors";
import type { DashboardData } from "@/lib/types";

type Props = {
  searchParams: Promise<{ key?: string; error?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { key, error } = await searchParams;
  // Keep the personal URL while replacing a session from a different employee.
  let employee = null;
  if (key !== undefined) {
    if (!key.trim() || key.length > 200) redirect("/api/auth");
    let matches = false;
    try {
      const [current, keyed] = await Promise.all([requireActiveEmployee(), findActiveEmployeeByKey(key.trim())]);
      matches = Boolean(current && keyed && current.recordId === keyed.recordId);
      if (matches) employee = current;
    } catch (caught) {
      console.error("Personal access validation failed", caught);
      redirect("/?error=server");
    }
    if (!matches) redirect(`/api/auth?key=${encodeURIComponent(key.trim())}`);
  }

  const initialError = error === "invalid-key"
    ? "유효하지 않은 개인 접속 링크이거나 현재 재직 상태가 아닙니다."
    : error === "server"
      ? "근태 데이터 서버에 연결하지 못했습니다. 잠시 후 다시 접속해 주세요."
      : undefined;

  let initialData: DashboardData | null = null;
  let loadError = initialError;
  if (!initialError) {
    try {
      employee = employee || await requireActiveEmployee();
      if (employee) {
        const today = todayInSeoul();
        const [requests, notices, todayVisitorCount] = await Promise.all([
          getEmployeeRequests(employee.employeeNo),
          getPublishedNotices(),
          getTodayVisitorCount(employee.employeeNo, today).catch((error) => {
            console.error("Visitor notification load failed", error);
            return 0;
          }),
        ]);
        initialData = { employee: publicEmployee(employee), requests, notices, todayVisitorCount };
      }
    } catch (caught) {
      console.error(caught);
      loadError = "근태 데이터 서버에 연결하지 못했습니다. 잠시 후 다시 접속해 주세요.";
    }
  }

  return <AttendanceApp initialData={initialData} initialError={loadError} initialToday={todayInSeoul()} />;
}

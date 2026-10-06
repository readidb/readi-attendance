import { redirect } from "next/navigation";
import AttendanceApp from "@/components/AttendanceApp";
import { requireActiveEmployee } from "@/lib/auth";
import { getDashboardData } from "@/lib/data";
import { todayInSeoul } from "@/lib/dates";
import type { DashboardData } from "@/lib/types";

type Props = {
  searchParams: Promise<{ key?: string | string[]; error?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { key, error } = await searchParams;
  // Explicit personal links always authenticate and replace the session in the route handler.
  if (key !== undefined) {
    if (typeof key !== "string" || !key.trim() || key.length > 200) redirect("/api/auth");
    redirect(`/api/auth?key=${encodeURIComponent(key.trim())}`);
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
      const employee = await requireActiveEmployee();
      if (employee) {
        initialData = await getDashboardData(employee);
      }
    } catch (caught) {
      console.error(caught);
      loadError = "근태 데이터 서버에 연결하지 못했습니다. 잠시 후 다시 접속해 주세요.";
    }
  }

  return <AttendanceApp initialData={initialData} initialError={loadError} initialToday={todayInSeoul()} />;
}

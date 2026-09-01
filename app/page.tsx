import { redirect } from "next/navigation";
import AttendanceApp from "@/components/AttendanceApp";
import { requireActiveEmployee } from "@/lib/auth";
import { getEmployeeRequests, getPublishedNotices, publicEmployee } from "@/lib/data";
import { todayInSeoul } from "@/lib/dates";
import type { DashboardData } from "@/lib/types";

type Props = {
  searchParams: Promise<{ key?: string; error?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { key, error } = await searchParams;
  if (key) redirect(`/api/auth?key=${encodeURIComponent(key)}`);

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
        const [requests, notices] = await Promise.all([
          getEmployeeRequests(employee.employeeNo),
          getPublishedNotices(),
        ]);
        initialData = { employee: publicEmployee(employee), requests, notices };
      }
    } catch (caught) {
      console.error(caught);
      loadError = "근태 데이터 서버에 연결하지 못했습니다. 잠시 후 다시 접속해 주세요.";
    }
  }

  return <AttendanceApp initialData={initialData} initialError={loadError} initialToday={todayInSeoul()} />;
}

import type { Metadata } from "next";
import VisitorCalendar from "@/components/VisitorCalendar";
import { todayInSeoul } from "@/lib/dates";
import "./calendar.css";

export const metadata: Metadata = {
  title: "READi 방문 예약 캘린더",
  description: "공유 방문 예약 등록 및 관리",
};

export const dynamic = "force-dynamic";

export default function VisitorCalendarPage() {
  return <VisitorCalendar today={todayInSeoul()} />;
}

import type { DashboardData } from "@/lib/types";

type Props = {
  data: DashboardData;
  onNavigate: (tab: "flexible" | "overtime" | "leave" | "visitors") => void;
};

export default function HomeSummary({ data, onNavigate }: Props) {
  const { employee, notices } = data;
  const overtimeClass = employee.remainingOvertimeLabel.includes("🔴")
    ? "danger"
    : employee.remainingOvertimeLabel.includes("🟡") ? "warning" : "safe";

  return (
    <div className="stack">
      {data.todayVisitorCount > 0 && (
        <button className="visitor-alert" type="button" onClick={() => onNavigate("visitors")}>
          오늘 담당 방문 예약이 {data.todayVisitorCount}건 있습니다.
          <span>확인하기</span>
        </button>
      )}
      <section className="weekly-summary" aria-label="이번 주 근무현황">
        <p className="summary-eyebrow">이번 주 근무현황</p>
        <h2 className="summary-greeting">{employee.department} {employee.name} {employee.position}님, 안녕하세요.</h2>
        <div className="summary-grid">
          <article className="metric-card">
            <span>금주 잔업</span>
            <strong>{employee.weeklyOvertime}<small>h</small></strong>
          </article>
          <article className={`metric-card ${overtimeClass}`} title={employee.remainingOvertimeLabel}>
            <span>잔여 가능</span>
            <strong>{Math.max(0, 12 - employee.weeklyOvertime)}<small>h</small></strong>
          </article>
          <article className="metric-card">
            <span>잔여 연차</span>
            <strong>{employee.remainingLeave}<small>일</small></strong>
          </article>
        </div>
      </section>

      <nav className="quick-actions" aria-label="근태 신청 바로가기">
        <button type="button" onClick={() => onNavigate("flexible")}>유연근무</button>
        <button type="button" onClick={() => onNavigate("overtime")}>잔업신청</button>
        <button type="button" onClick={() => onNavigate("leave")}>연차신청</button>
      </nav>

      <section className="panel notices">
        <div className="section-heading">
          <h2>공지사항</h2>
          <span>{notices.length}건</span>
        </div>
        {notices.length === 0 ? (
          <p className="empty-text">등록된 공지사항이 없습니다.</p>
        ) : notices.map((notice) => (
          <article className={`notice-item ${notice.important ? "important" : ""}`} key={notice.id}>
            <div className="notice-title">
              <strong>{notice.important && <span className="notice-badge">중요</span>}{notice.title}</strong>
            </div>
            <p>{notice.content}</p>
            {notice.attachments.map((file) => (
              <a key={file.id} href={file.url} target="_blank" rel="noreferrer">첨부: {file.filename}</a>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}

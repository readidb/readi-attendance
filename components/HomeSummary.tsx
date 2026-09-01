import type { DashboardData } from "@/lib/types";

type Props = {
  data: DashboardData;
  onNavigate: (tab: "flexible" | "overtime" | "leave") => void;
};

export default function HomeSummary({ data, onNavigate }: Props) {
  const { employee, notices } = data;
  const overtimeClass = employee.remainingOvertimeLabel.includes("🔴")
    ? "danger"
    : employee.remainingOvertimeLabel.includes("🟡") ? "warning" : "safe";

  return (
    <div className="stack">
      <section className="summary-grid" aria-label="근무 현황">
        <article className="metric-card">
          <span>금주 잔업</span>
          <strong>{employee.weeklyOvertime}h</strong>
        </article>
        <article className={`metric-card ${overtimeClass}`}>
          <span>잔여 가능</span>
          <strong>{employee.remainingOvertimeLabel}</strong>
        </article>
        <article className="metric-card full">
          <span>잔여 연차</span>
          <strong>{employee.remainingLeave}일</strong>
        </article>
      </section>

      <section className="panel">
        <h2>근태 신청</h2>
        <div className="quick-actions">
          <button type="button" onClick={() => onNavigate("flexible")}>유연근무</button>
          <button type="button" onClick={() => onNavigate("overtime")}>잔업신청</button>
          <button type="button" onClick={() => onNavigate("leave")}>연차신청</button>
        </div>
      </section>

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
              <strong>{notice.important ? "[중요] " : ""}{notice.title}</strong>
              <time>{notice.publishDate}</time>
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

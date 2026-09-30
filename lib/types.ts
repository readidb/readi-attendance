export type SelectValue = { id?: string; name?: string; color?: string } | string | null;

export interface Employee {
  recordId: string;
  employeeNo: number;
  name: string;
  department: string;
  position: string;
  weeklyOvertime: number;
  remainingOvertimeLabel: string;
  remainingLeave: number;
}

export interface RequestItem {
  id: string;
  createdAt: string;
  requestNo: string;
  category: "flexible" | "overtime" | "leave";
  typeLabel: string;
  dateLabel: string;
  detail: string;
  status?: string;
}

export interface NoticeAttachment {
  id: string;
  filename: string;
  url: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  important: boolean;
  publishDate: string;
  attachments: NoticeAttachment[];
}

export interface DashboardData {
  employee: Omit<Employee, "recordId">;
  requests: RequestItem[];
  notices: Notice[];
  todayVisitorCount: number;
}

export interface VisitorHost {
  recordId: string;
  employeeNo: number;
  name: string;
  department: string;
  position: string;
  phone: string;
}

export interface VisitorReservation {
  id: string;
  reservationNo: string;
  visitDate: string;
  visitTime: string;
  location: string;
  department: string;
  hostRecordId: string;
  hostName: string;
  hostPhone: string;
  company: string;
  vehicleNo: string;
  headcount: number;
  purpose: string;
  note: string;
  appliedDate: string;
}

export interface VisitorData {
  reservations: VisitorReservation[];
  hosts: VisitorHost[];
  currentHostRecordId: string;
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

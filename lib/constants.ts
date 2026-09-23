export const TABLES = {
  master: "tblUZAldAbUpJcx8O",
  flexible: "tblqgn1i0kunetWeg",
  overtime: "tbl7o76n3WifMxuAZ",
  caps: "tblVYYudzdw4VmtUM",
  leave: "tblOpBm4PTXLkHRrz",
  notices: "tblibO9m4g0oFb3rs",
} as const;

export const FIELDS = {
  master: {
    employeeNo: "fldVteukRJwty5Cn1",
    name: "fldgVwVeEdKhiiFzo",
    department: "fldudp3Q0AAVF1Cx0",
    position: "fldEfRIqDEz2ui6Zy",
    remainingLeave: "fldHCLRyD1JbdaZ9v",
    weeklyOvertime: "fldky0D4kdr273WPX",
    remainingOvertimeLabel: "fldxHPt8RzhP9JylX",
    status: "fldvCBoyfISwh8VyD",
    mobileKey: "fldI1AZYrmEmEAt8Q",
  },
  flexible: {
    requestNo: "fldUzk8FRd3K5wVIF",
    employee: "fldOUHRbZBi96UB0C",
    createdAt: "fldwbmEewNJ7LBew3",
    date: "fldg8v10wfXB88gp6",
    schedule: "fldNY9d2SDyH6eUJB",
    note: "flduqC70aTLcH5sm5",
  },
  overtime: {
    requestNo: "fldBH4dKUPRCDAt4o",
    employee: "fldv2rWg2d61EY9ml",
    schedule: "fldu6Ti7VfmzEis5k",
    date: "fldXgf65zRLtGcOLP",
    endAt: "fldy9NgrFeokof0I2",
    hours: "fldGOYpqImp2o0rOp",
    internalMeal: "fldRuBu1RLnZmyvdA", // 사내식사 (앱: 사내배달)
    externalMeal: "fldqPuT69Sntumaio", // 외부식사 (기존 식사여부)
    reason: "fldbymc5dvz4f90IO",
    actualHours: "fldilw0r9U5jTZ8yw",
    validationStatus: "fldNSuvzXuwnqxkv6",
    confirmedHours: "fld5Vp4ckWT0A886e",
    createdAt: "flddj6JjzpxZjFMSM",
  },
  leave: {
    requestNo: "fldP6nESQKAgxuM8P",
    employee: "fldjxtU9QHP7uyDjw",
    type: "fldx9POoXjunn46Kz",
    startDate: "fldwUAgbW22ikQbsk",
    endDate: "fldtChc7CQJp4OVw5",
    days: "fld1umvffzI1SG2WC",
    reason: "fldxuuYcKrGMMEdz1",
    createdAt: "fldD1tKvGf80ByP7t",
  },
  notices: {
    title: "fldM7QE0M5YMzvtKr",
    content: "fldIA4HvvS0UKS9r8",
    published: "fldF9RrHIFo6n9M9U",
    important: "flduHEeWsy31T8OtY",
    publishDate: "fldj4BgE9cviz017q",
    attachments: "fldNKqcBTa24rS3iq",
  },
} as const;

export const FLEXIBLE_SCHEDULES = [
  "05:00 ~ 14:00",
  "05:30 ~ 14:30",
  "06:00 ~ 15:00",
  "06:30 ~ 15:30",
  "07:00 ~ 16:00",
  "07:30 ~ 16:30",
  "08:00 ~ 17:00",
  "08:30 ~ 17:30",
  "09:00 ~ 18:00",
  "09:30 ~ 18:30",
  "10:00 ~ 19:00",
] as const;

export const LEAVE_TYPES = ["연차", "오전반차", "오후반차", "리프레시", "공가"] as const;
export const STANDARD_SCHEDULE = "08:00 ~ 17:00";
export const SEOUL_TIME_ZONE = "Asia/Seoul";

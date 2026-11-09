export type BlockJoiner = "and" | "comma" | "slash"

export const DUTY_TYPES = ["7am", "11am", "gerugambakkam", "night"] as const
export type DutyType = (typeof DUTY_TYPES)[number]

export const STAFF_STATUSES = ["working", "leave", "comp_off", "weekly_off"] as const
export type StaffStatus = (typeof STAFF_STATUSES)[number]

export const SCHEDULE_STATUSES = ["draft", "finalized"] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]

export interface StaffMember {
  id: string
  name: string
  display_name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface WorkBlock {
  id: string
  name: string
  display_name: string
  is_active: boolean
  sort_order: number
  created_at: string
}

/** A block as it was named when the schedule was saved. */
export interface AssignmentBlock {
  block_id: string
  block_name: string
  block_display_name: string
}

/** One staff member's duty for one day, including historical name snapshots. */
export interface StaffAssignment {
  staff_id: string
  staff_name: string
  staff_display_name: string
  status: StaffStatus
  duty: DutyType | null
  blocks: AssignmentBlock[]
}

export interface AppSettings {
  id: boolean
  message_heading: string
  duty_7am_label: string
  duty_11am_label: string
  gerugambakkam_label: string
  night_duty_label: string
  leave_label: string
  comp_off_label: string
  weekly_off_label: string
  block_joiner: BlockJoiner
  block_abbreviations: Record<string, string>
  updated_at?: string
}

export type SettingsInput = Omit<AppSettings, "id" | "updated_at">

export interface DailySchedule {
  id: string
  schedule_date: string
  assignments: StaffAssignment[]
  generated_message: string | null
  final_message: string | null
  status: ScheduleStatus
  created_at: string
  updated_at: string
}

export const DEFAULT_SETTINGS: SettingsInput = {
  message_heading: "Duty Schedule – {date}",
  duty_7am_label: "7 AM Shift",
  duty_11am_label: "11:30 AM Duty",
  gerugambakkam_label: "Gerugambakkam Duty",
  night_duty_label: "Night Duty",
  leave_label: "Leave",
  comp_off_label: "Comp Off",
  weekly_off_label: "Weekly Off",
  block_joiner: "and",
  block_abbreviations: {},
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: true,
  ...DEFAULT_SETTINGS,
}

export function getDutyLabel(settings: AppSettings, duty: DutyType): string {
  switch (duty) {
    case "7am":
      return settings.duty_7am_label
    case "11am":
      return settings.duty_11am_label
    case "gerugambakkam":
      return settings.gerugambakkam_label
    case "night":
      return settings.night_duty_label
  }
}

export function getStatusLabel(settings: AppSettings, status: StaffStatus): string {
  switch (status) {
    case "leave":
      return settings.leave_label
    case "comp_off":
      return settings.comp_off_label
    case "weekly_off":
      return settings.weekly_off_label
    case "working":
      return "Working"
  }
}

export function defaultDutyLabels(): Record<DutyType, string> {
  return {
    "7am": DEFAULT_SETTINGS.duty_7am_label,
    "11am": DEFAULT_SETTINGS.duty_11am_label,
    gerugambakkam: DEFAULT_SETTINGS.gerugambakkam_label,
    night: DEFAULT_SETTINGS.night_duty_label,
  }
}

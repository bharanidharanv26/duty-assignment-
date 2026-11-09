import { formatFullDate } from "./date"
import {
  DUTY_TYPES,
  STAFF_STATUSES,
  getDutyLabel,
  getStatusLabel,
  type AppSettings,
  type AssignmentBlock,
  type DutyType,
  type StaffAssignment,
  type StaffMember,
  type StaffStatus,
  type WorkBlock,
} from "./types"

export function snapshotBlock(block: WorkBlock): AssignmentBlock {
  return {
    block_id: block.id,
    block_name: block.name,
    block_display_name: block.display_name,
  }
}

export function createEmptyAssignment(staff: StaffMember): StaffAssignment {
  return {
    staff_id: staff.id,
    staff_name: staff.name,
    staff_display_name: staff.display_name,
    status: "working",
    duty: null,
    blocks: [],
  }
}

function sortBlocksByOrder(
  blocks: AssignmentBlock[],
  order: Map<string, number>,
): AssignmentBlock[] {
  return [...blocks].sort(
    (a, b) => (order.get(a.block_id) ?? 999) - (order.get(b.block_id) ?? 999),
  )
}

/** Safe parsing of the assignments JSON stored in Supabase. */
export function parseAssignments(raw: unknown): StaffAssignment[] {
  if (!Array.isArray(raw)) return []
  const parsed: StaffAssignment[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const value = entry as Record<string, unknown>
    if (typeof value.staff_id !== "string") continue
    const status = STAFF_STATUSES.includes(value.status as StaffStatus)
      ? (value.status as StaffStatus)
      : "working"
    const duty = DUTY_TYPES.includes(value.duty as DutyType)
      ? (value.duty as DutyType)
      : null
    const blocks: AssignmentBlock[] = Array.isArray(value.blocks)
      ? value.blocks.flatMap((block) => {
          if (!block || typeof block !== "object") return []
          const rawBlock = block as Record<string, unknown>
          if (typeof rawBlock.block_id !== "string") return []
          const name =
            typeof rawBlock.block_name === "string" ? rawBlock.block_name : "Block"
          return [
            {
              block_id: rawBlock.block_id,
              block_name: name,
              block_display_name:
                typeof rawBlock.block_display_name === "string"
                  ? rawBlock.block_display_name
                  : name,
            },
          ]
        })
      : []
    parsed.push({
      staff_id: value.staff_id,
      staff_name: typeof value.staff_name === "string" ? value.staff_name : "",
      staff_display_name:
        typeof value.staff_display_name === "string"
          ? value.staff_display_name
          : typeof value.staff_name === "string"
            ? value.staff_name
            : "Staff",
      status,
      duty,
      blocks,
    })
  }
  return parsed
}

/**
 * Build the assignment list for a date.
 *
 * - Active staff always appear, in the order defined in Staff & Blocks.
 * - An existing saved schedule keeps its name snapshots.
 * - A brand new schedule starts empty.
 * - People in a saved schedule who are no longer active are kept visible at the end.
 */
export function buildAssignments(params: {
  staff: StaffMember[]
  blocks: WorkBlock[]
  saved?: StaffAssignment[] | null
}): StaffAssignment[] {
  const { staff, blocks, saved } = params
  const savedById = new Map((saved ?? []).map((entry) => [entry.staff_id, entry]))
  const order = new Map(blocks.map((block, index) => [block.id, index]))

  const result = staff.map((member) => {
    const existing = savedById.get(member.id)
    if (existing) {
      return { ...existing, blocks: sortBlocksByOrder(existing.blocks, order) }
    }
    return createEmptyAssignment(member)
  })

  const knownIds = new Set(result.map((entry) => entry.staff_id))
  for (const entry of saved ?? []) {
    if (knownIds.has(entry.staff_id)) continue
    result.push({ ...entry, blocks: sortBlocksByOrder(entry.blocks, order) })
  }
  return result
}

export function applyStatusChange(
  assignment: StaffAssignment,
  status: StaffStatus,
): StaffAssignment {
  if (status === "working") {
    return { ...assignment, status }
  }
  return { ...assignment, status, duty: null, blocks: [] }
}

export function applyDutyChange(
  assignment: StaffAssignment,
  duty: DutyType | null,
): StaffAssignment {
  if (duty === null) {
    return { ...assignment, duty }
  }
  return { ...assignment, duty, status: "working" }
}

export function toggleBlock(
  assignment: StaffAssignment,
  block: WorkBlock,
  blocks: WorkBlock[],
): StaffAssignment {
  const exists = assignment.blocks.some((entry) => entry.block_id === block.id)
  const order = new Map(blocks.map((entry, index) => [entry.id, index]))
  const nextBlocks = exists
    ? assignment.blocks.filter((entry) => entry.block_id !== block.id)
    : sortBlocksByOrder([...assignment.blocks, snapshotBlock(block)], order)
  return { ...assignment, status: "working", blocks: nextBlocks }
}

/** Blocks a sister can choose: unassigned blocks plus her own existing blocks. */
export function availableBlocksForAssignment(
  assignment: StaffAssignment,
  activeBlocks: WorkBlock[],
  assignments: StaffAssignment[],
): WorkBlock[] {
  const ownIds = new Set(assignment.blocks.map((block) => block.block_id))
  const takenByOthers = new Set(
    assignments
      .filter((entry) => entry.staff_id !== assignment.staff_id)
      .flatMap((entry) => entry.blocks.map((block) => block.block_id)),
  )
  return activeBlocks.filter(
    (block) => ownIds.has(block.id) || !takenByOthers.has(block.id),
  )
}

export function blocksForAssignment(
  assignment: StaffAssignment,
  activeBlocks: WorkBlock[],
): WorkBlock[] {
  const knownIds = new Set(activeBlocks.map((block) => block.id))
  const extra = assignment.blocks
    .filter((block) => !knownIds.has(block.block_id))
    .map<WorkBlock>((block) => ({
      id: block.block_id,
      name: block.block_name,
      display_name: block.block_display_name,
      is_active: false,
      sort_order: 999,
      created_at: "",
    }))
  return [...activeBlocks, ...extra]
}

export interface ValidationIssue {
  code: string
  message: string
  staffIds: string[]
}

export interface ValidationLabels {
  duty: Record<DutyType, string>
  leave: string
  compOff: string
  weeklyOff: string
}

const DEFAULT_LABELS: ValidationLabels = {
  duty: {
    "7am": "7 AM duty",
    "11am": "11 AM duty",
    gerugambakkam: "Gerugambakkam duty",
    night: "Night duty",
  },
  leave: "Leave",
  compOff: "Comp Off",
  weeklyOff: "Weekly Off",
}

function joinNames(assignments: StaffAssignment[]): string {
  const names = assignments.map((entry) => entry.staff_display_name)
  if (names.length <= 1) return names.join("")
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/**
 * Checks every duty rule. Returns one readable issue per problem.
 * An empty list means the schedule can be saved.
 */
export function validateAssignments(
  assignments: StaffAssignment[],
  labels: ValidationLabels = DEFAULT_LABELS,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seenStaff = new Set<string>()

  for (const assignment of assignments) {
    if (seenStaff.has(assignment.staff_id)) {
      issues.push({
        code: "duplicate-staff",
        message: `${assignment.staff_display_name} appears twice in this schedule.`,
        staffIds: [assignment.staff_id],
      })
      continue
    }
    seenStaff.add(assignment.staff_id)

    const hasDuties = assignment.duty !== null || assignment.blocks.length > 0
    if (assignment.status === "leave" && hasDuties) {
      issues.push({
        code: "leave-conflict",
        message: `${assignment.staff_display_name} is on ${labels.leave} and cannot have other duties.`,
        staffIds: [assignment.staff_id],
      })
    }
    if (assignment.status === "comp_off" && hasDuties) {
      issues.push({
        code: "comp-off-conflict",
        message: `${assignment.staff_display_name} is on ${labels.compOff} and cannot have other duties.`,
        staffIds: [assignment.staff_id],
      })
    }
    if (assignment.status === "weekly_off" && hasDuties) {
      issues.push({
        code: "weekly-off-conflict",
        message: `${assignment.staff_display_name} is on ${labels.weeklyOff} and cannot have other duties.`,
        staffIds: [assignment.staff_id],
      })
    }
  }

  for (const duty of DUTY_TYPES) {
    const holders = assignments.filter((entry) => entry.duty === duty)
    if (holders.length > 1) {
      issues.push({
        code: `duplicate-duty-${duty}`,
        message: `${labels.duty[duty]} is assigned to ${joinNames(holders)}. Only one person can have it.`,
        staffIds: holders.map((entry) => entry.staff_id),
      })
    }
  }

  const blocksById = new Map<string, { label: string; staff: StaffAssignment[] }>()
  for (const assignment of assignments) {
    for (const block of assignment.blocks) {
      const existing = blocksById.get(block.block_id)
      if (existing) {
        existing.staff.push(assignment)
      } else {
        blocksById.set(block.block_id, {
          label: block.block_display_name,
          staff: [assignment],
        })
      }
    }
  }
  for (const [, entry] of blocksById) {
    if (entry.staff.length > 1) {
      issues.push({
        code: "duplicate-block",
        message: `${entry.label} is assigned to ${joinNames(entry.staff)}. A block can only have one person per day.`,
        staffIds: entry.staff.map((assignment) => assignment.staff_id),
      })
    }
  }

  return issues
}

export function issuesByStaff(issues: ValidationIssue[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const issue of issues) {
    for (const staffId of issue.staffIds) {
      map.set(staffId, [...(map.get(staffId) ?? []), issue.message])
    }
  }
  return map
}

/** Every part of a person's day, used by the message generator. */
export function describeAssignment(
  assignment: StaffAssignment,
  settings: AppSettings,
): string[] {
  if (assignment.status === "leave") return [getStatusLabel(settings, "leave")]
  if (assignment.status === "comp_off") return [getStatusLabel(settings, "comp_off")]
  if (assignment.status === "weekly_off") return [getStatusLabel(settings, "weekly_off")]

  const parts: string[] = []
  if (assignment.duty) parts.push(getDutyLabel(settings, assignment.duty))
  const blockNames = assignment.blocks.map((block) => {
    const abbreviation = settings.block_abbreviations[block.block_id]?.trim()
    return abbreviation || block.block_display_name
  })
  if (blockNames.length > 0) parts.push(joinBlockNames(blockNames, settings.block_joiner))
  return parts
}

export function joinBlockNames(names: string[], joiner: AppSettings["block_joiner"]): string {
  if (names.length <= 1) return names.join("")
  switch (joiner) {
    case "comma":
      return names.join(", ")
    case "slash":
      return names.join(" / ")
    case "and":
    default:
      return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
  }
}

/** The WhatsApp-friendly message built from the current assignments. */
export function generateScheduleMessage(
  assignments: StaffAssignment[],
  settings: AppSettings,
  dateISO: string,
): string {
  const heading = settings.message_heading
    .replaceAll("{date}", formatFullDate(dateISO))
    .trim()
  const lines = assignments.flatMap((assignment) => {
    const parts = describeAssignment(assignment, settings)
    if (parts.length === 0) return []
    return [`${assignment.staff_display_name} – ${parts.join(", ")}`]
  })
  return [heading, lines.join("\n")].filter(Boolean).join("\n\n").trim()
}

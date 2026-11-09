import { parseAssignments } from "./assignments"
import { requireSupabase } from "./supabase"
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type DailySchedule,
  type ScheduleStatus,
  type SettingsInput,
  type StaffAssignment,
  type StaffMember,
  type WorkBlock,
} from "./types"

function message(error: { message: string }): string {
  return error.message
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export async function fetchStaff(): Promise<StaffMember[]> {
  const { data, error } = await requireSupabase()
    .from("staff")
    .select("*")
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) throw new Error(message(error))
  return (data ?? []) as StaffMember[]
}

export async function createStaff(input: {
  name: string
  display_name: string
}): Promise<StaffMember> {
  const client = requireSupabase()
  const { data: last } = await client
    .from("staff")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((last?.sort_order as number | undefined) ?? 0) + 1
  const { data, error } = await client
    .from("staff")
    .insert({
      name: input.name.trim(),
      display_name: input.display_name.trim(),
      sort_order: nextOrder,
    })
    .select("*")
    .single()
  if (error) throw new Error(message(error))
  return data as StaffMember
}

export async function updateStaff(
  id: string,
  input: { name: string; display_name: string },
): Promise<void> {
  const { error } = await requireSupabase()
    .from("staff")
    .update({ name: input.name.trim(), display_name: input.display_name.trim() })
    .eq("id", id)
  if (error) throw new Error(message(error))
}

export async function setStaffActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from("staff")
    .update({ is_active: isActive })
    .eq("id", id)
  if (error) throw new Error(message(error))
}

export async function reorderStaff(orderedIds: string[]): Promise<void> {
  const client = requireSupabase()
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const { error } = await client
        .from("staff")
        .update({ sort_order: index + 1 })
        .eq("id", id)
      if (error) throw new Error(message(error))
    }),
  )
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

export async function fetchBlocks(): Promise<WorkBlock[]> {
  const { data, error } = await requireSupabase()
    .from("blocks")
    .select("*")
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) throw new Error(message(error))
  return (data ?? []) as WorkBlock[]
}

export async function createBlock(input: {
  name: string
  display_name: string
}): Promise<WorkBlock> {
  const client = requireSupabase()
  const { data: last } = await client
    .from("blocks")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((last?.sort_order as number | undefined) ?? 0) + 1
  const { data, error } = await client
    .from("blocks")
    .insert({
      name: input.name.trim(),
      display_name: input.display_name.trim(),
      sort_order: nextOrder,
    })
    .select("*")
    .single()
  if (error) throw new Error(message(error))
  return data as WorkBlock
}

export async function updateBlock(
  id: string,
  input: { name: string; display_name: string },
): Promise<void> {
  const { error } = await requireSupabase()
    .from("blocks")
    .update({ name: input.name.trim(), display_name: input.display_name.trim() })
    .eq("id", id)
  if (error) throw new Error(message(error))
}

export async function setBlockActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from("blocks")
    .update({ is_active: isActive })
    .eq("id", id)
  if (error) throw new Error(message(error))
}

export async function reorderBlocks(orderedIds: string[]): Promise<void> {
  const client = requireSupabase()
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const { error } = await client
        .from("blocks")
        .update({ sort_order: index + 1 })
        .eq("id", id)
      if (error) throw new Error(message(error))
    }),
  )
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await requireSupabase()
    .from("app_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle()
  if (error) throw new Error(message(error))
  if (!data) return { id: true, ...DEFAULT_SETTINGS }
  return {
    ...DEFAULT_SETTINGS,
    ...(data as AppSettings),
    id: true,
    block_abbreviations:
      (data as AppSettings).block_abbreviations &&
      typeof (data as AppSettings).block_abbreviations === "object"
        ? (data as AppSettings).block_abbreviations
        : {},
  }
}

export async function saveSettings(input: SettingsInput): Promise<AppSettings> {
  const abbreviations = Object.fromEntries(
    Object.entries(input.block_abbreviations)
      .map(([blockId, value]) => [blockId, value.trim()])
      .filter(([, value]) => value.length > 0),
  )
  const { data, error } = await requireSupabase()
    .from("app_settings")
    .upsert({
      id: true,
      ...input,
      block_abbreviations: abbreviations,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error) throw new Error(message(error))
  return { ...DEFAULT_SETTINGS, ...(data as AppSettings), id: true }
}

/* -------------------------------------------------------------------------- */
/* Daily schedules                                                            */
/* -------------------------------------------------------------------------- */

interface ScheduleRow {
  id: string
  schedule_date: string
  assignments: unknown
  generated_message: string | null
  final_message: string | null
  status: ScheduleStatus
  created_at: string
  updated_at: string
}

function mapSchedule(row: ScheduleRow): DailySchedule {
  return {
    ...row,
    status: row.status === "draft" ? "draft" : "finalized",
    assignments: parseAssignments(row.assignments),
  }
}

export async function fetchSchedule(dateISO: string): Promise<DailySchedule | null> {
  const { data, error } = await requireSupabase()
    .from("daily_schedules")
    .select("*")
    .eq("schedule_date", dateISO)
    .maybeSingle()
  if (error) throw new Error(message(error))
  return data ? mapSchedule(data as ScheduleRow) : null
}

export async function fetchSchedulesForMonth(
  startISO: string,
  endISO: string,
): Promise<DailySchedule[]> {
  const { data, error } = await requireSupabase()
    .from("daily_schedules")
    .select("*")
    .gte("schedule_date", startISO)
    .lte("schedule_date", endISO)
    .order("schedule_date", { ascending: false })
  if (error) throw new Error(message(error))
  return ((data ?? []) as ScheduleRow[]).map(mapSchedule)
}

export async function fetchPreviousSchedule(dateISO: string): Promise<DailySchedule | null> {
  const { data, error } = await requireSupabase()
    .from("daily_schedules")
    .select("*")
    .lt("schedule_date", dateISO)
    .order("schedule_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(message(error))
  return data ? mapSchedule(data as ScheduleRow) : null
}

export interface SaveScheduleInput {
  schedule_date: string
  assignments: StaffAssignment[]
  generated_message: string | null
  final_message: string | null
  status: ScheduleStatus
}

export async function saveSchedule(input: SaveScheduleInput): Promise<DailySchedule> {
  const { data, error } = await requireSupabase()
    .from("daily_schedules")
    .upsert(input, { onConflict: "schedule_date" })
    .select("*")
    .single()
  if (error) throw new Error(message(error))
  return mapSchedule(data as ScheduleRow)
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("daily_schedules")
    .delete()
    .eq("id", id)
  if (error) throw new Error(message(error))
}

import { describe, expect, it } from "vitest"
import {
  applyStatusChange,
  availableBlocksForAssignment,
  buildAssignments,
  generateScheduleMessage,
  snapshotBlock,
  toggleBlock,
  validateAssignments,
} from "./assignments"
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type StaffAssignment,
  type StaffMember,
  type WorkBlock,
} from "./types"

const DATE = "2026-11-09"

function staff(id: string, name: string, sortOrder: number): StaffMember {
  return {
    id,
    name,
    display_name: name,
    is_active: true,
    sort_order: sortOrder,
    created_at: "",
  }
}

function block(id: string, name: string, sortOrder: number): WorkBlock {
  return {
    id,
    name,
    display_name: name,
    is_active: true,
    sort_order: sortOrder,
    created_at: "",
  }
}

const people = {
  jeeva: staff("s1", "Sister Jeeva", 1),
  devabakiyam: staff("s2", "Sister Devabakiyam", 2),
  muthalagi: staff("s3", "Sister Muthalagi", 3),
  ranjitha: staff("s4", "Sis. Ranjitha", 4),
  deepa: staff("s5", "Sis. Deepa", 5),
  shantha: staff("s6", "Sis. Shantha", 6),
  kamatchi: staff("s7", "Sister Kamatchi", 7),
  uma: staff("s8", "Sister Uma", 8),
  esaidevi: staff("s9", "Sis. Esaidevi", 9),
  ester: staff("s10", "Sis. Ester", 10),
}

const blockList = {
  phone: block("b1", "Phone Block", 1),
  mahadevan: block("b2", "Mahadevan Block", 2),
  shanthi: block("b3", "Shanthi Block", 3),
  japan: block("b4", "Japan Block", 4),
  helpage: block("b5", "Helpage Block", 5),
  veg: block("b6", "Veg Block", 6),
  cyithiya: block("b9", "Cyithiya Block", 9),
}

function assignment(
  member: StaffMember,
  overrides: Partial<StaffAssignment> = {},
): StaffAssignment {
  return {
    staff_id: member.id,
    staff_name: member.name,
    staff_display_name: member.display_name,
    status: "working",
    duty: null,
    blocks: [],
    ...overrides,
  }
}

function validSchedule(): StaffAssignment[] {
  return [
    assignment(people.jeeva, { status: "comp_off" }),
    assignment(people.devabakiyam, { blocks: [snapshotBlock(blockList.shanthi)] }),
    assignment(people.muthalagi, { blocks: [snapshotBlock(blockList.japan)] }),
    assignment(people.ranjitha, { duty: "7am" }),
    assignment(people.deepa, { duty: "11am" }),
    assignment(people.shantha, {
      blocks: [snapshotBlock(blockList.helpage), snapshotBlock(blockList.cyithiya)],
    }),
    assignment(people.kamatchi, { duty: "gerugambakkam" }),
    assignment(people.uma, { status: "leave" }),
    assignment(people.esaidevi, { blocks: [snapshotBlock(blockList.phone)] }),
    assignment(people.ester, { blocks: [snapshotBlock(blockList.veg)] }),
  ]
}

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_APP_SETTINGS, ...overrides }
}

describe("validateAssignments", () => {
  it("accepts a schedule that follows every rule", () => {
    expect(validateAssignments(validSchedule())).toEqual([])
  })

  it("allows a partial schedule without every duty or sister assigned", () => {
    const schedule = validSchedule().map((entry) =>
      entry.staff_id === people.ranjitha.id ||
      entry.staff_id === people.deepa.id ||
      entry.staff_id === people.ester.id
        ? { ...entry, duty: null, blocks: [] }
        : entry,
    )
    expect(validateAssignments(schedule)).toEqual([])
  })

  it("reports a duty assigned to two people", () => {
    const schedule = validSchedule().map((entry) =>
      entry.staff_id === people.ester.id ? { ...entry, duty: "11am" as const } : entry,
    )
    const issue = validateAssignments(schedule).find(
      (entry) => entry.code === "duplicate-duty-11am",
    )
    expect(issue?.message).toContain("Sis. Deepa")
    expect(issue?.message).toContain("Sis. Ester")
  })

  it("reports a block assigned to two people", () => {
    const schedule = validSchedule().map((entry) =>
      entry.staff_id === people.ester.id
        ? { ...entry, blocks: [snapshotBlock(blockList.phone)] }
        : entry,
    )
    const issue = validateAssignments(schedule).find(
      (entry) => entry.code === "duplicate-block",
    )
    expect(issue?.message).toContain("Phone Block")
    expect(issue?.message).toContain("Sis. Esaidevi")
  })

  it("reports Leave, Comp Off and Weekly Off combined with other duties", () => {
    const schedule = validSchedule().map((entry) =>
      entry.staff_id === people.uma.id
        ? { ...entry, blocks: [snapshotBlock(blockList.veg)] }
        : entry.staff_id === people.jeeva.id
          ? { ...entry, duty: "7am" as const }
          : entry.staff_id === people.ester.id
            ? { ...entry, status: "weekly_off" as const }
            : entry,
    )
    const codes = validateAssignments(schedule).map((issue) => issue.code)
    expect(codes).toContain("leave-conflict")
    expect(codes).toContain("comp-off-conflict")
    expect(codes).toContain("weekly-off-conflict")
  })
})

describe("assignment helpers", () => {
  it("clears duties and blocks when Leave, Comp Off or Weekly Off is chosen", () => {
    const working = assignment(people.uma, {
      duty: "7am",
      blocks: [snapshotBlock(blockList.phone)],
    })
    const leave = applyStatusChange(working, "leave")
    expect(leave.status).toBe("leave")
    expect(leave.duty).toBeNull()
    expect(leave.blocks).toEqual([])

    const weeklyOff = applyStatusChange(working, "weekly_off")
    expect(weeklyOff.status).toBe("weekly_off")
    expect(weeklyOff.duty).toBeNull()
    expect(weeklyOff.blocks).toEqual([])

    const backToWorking = applyStatusChange(leave, "working")
    expect(backToWorking.status).toBe("working")
    expect(backToWorking.blocks).toEqual([])
  })

  it("offers each sister only unassigned blocks plus her own selected blocks", () => {
    const uma = assignment(people.uma, {
      blocks: [snapshotBlock(blockList.phone), snapshotBlock(blockList.shanthi)],
    })
    const devabakiyam = assignment(people.devabakiyam)
    const blocks = [blockList.phone, blockList.shanthi, blockList.japan]

    expect(
      availableBlocksForAssignment(devabakiyam, blocks, [uma, devabakiyam]).map(
        (block) => block.id,
      ),
    ).toEqual([blockList.japan.id])
    expect(
      availableBlocksForAssignment(uma, blocks, [uma, devabakiyam]).map(
        (block) => block.id,
      ),
    ).toEqual([blockList.phone.id, blockList.shanthi.id, blockList.japan.id])

    const conflicting = assignment(people.devabakiyam, {
      blocks: [snapshotBlock(blockList.phone)],
    })
    expect(
      availableBlocksForAssignment(conflicting, blocks, [uma, conflicting]).map(
        (block) => block.id,
      ),
    ).toContain(blockList.phone.id)
  })

  it("switches a person to working when a block is selected", () => {
    const onLeave = assignment(people.uma, { status: "leave" })
    const next = toggleBlock(onLeave, blockList.phone, [blockList.phone])
    expect(next.status).toBe("working")
    expect(next.blocks.map((entry) => entry.block_id)).toEqual(["b1"])

    const removed = toggleBlock(next, blockList.phone, [blockList.phone])
    expect(removed.blocks).toEqual([])
  })

  it("starts new schedules empty and keeps saved snapshots", () => {
    const saved: StaffAssignment[] = [
      {
        ...assignment(people.muthalagi),
        staff_display_name: "Sister Muthalagi (old)",
        blocks: [
          {
            block_id: blockList.japan.id,
            block_name: "Old Japan",
            block_display_name: "Old Japan",
          },
        ],
      },
    ]
    const built = buildAssignments({
      staff: [people.muthalagi, people.devabakiyam],
      blocks: [blockList.phone, blockList.japan],
      saved,
    })

    const muthalagi = built.find((entry) => entry.staff_id === people.muthalagi.id)
    expect(muthalagi?.staff_display_name).toBe("Sister Muthalagi (old)")
    expect(muthalagi?.blocks[0].block_name).toBe("Old Japan")

    const devabakiyam = built.find((entry) => entry.staff_id === people.devabakiyam.id)
    expect(devabakiyam?.blocks).toEqual([])
    expect(devabakiyam?.duty).toBeNull()
  })
})

describe("generateScheduleMessage", () => {
  it("builds the WhatsApp message from the real assignments", () => {
    const message = generateScheduleMessage(validSchedule(), settings(), DATE)
    expect(message).toBe(
      [
        "Duty Schedule – Monday, 9 November 2026",
        "",
        "Sister Jeeva – Comp Off",
        "Sister Devabakiyam – Shanthi Block",
        "Sister Muthalagi – Japan Block",
        "Sis. Ranjitha – 7 AM Shift",
        "Sis. Deepa – 11:30 AM Duty",
        "Sis. Shantha – Helpage Block and Cyithiya Block",
        "Sister Kamatchi – Gerugambakkam Duty",
        "Sister Uma – Leave",
        "Sis. Esaidevi – Phone Block",
        "Sis. Ester – Veg Block",
      ].join("\n"),
    )
  })

  it("writes Weekly Off in the message and uses its custom label", () => {
    const schedule = validSchedule().map((entry) =>
      entry.staff_id === people.ester.id
        ? { ...entry, status: "weekly_off" as const, blocks: [] }
        : entry,
    )
    expect(generateScheduleMessage(schedule, settings(), DATE)).toContain(
      "Sis. Ester – Weekly Off",
    )
    expect(
      generateScheduleMessage(schedule, settings({ weekly_off_label: "Week Off" }), DATE),
    ).toContain("Sis. Ester – Week Off")
  })

  it("writes Night Duty in the message and uses its custom label", () => {
    const schedule = validSchedule().map((entry) =>
      entry.staff_id === people.ester.id
        ? { ...entry, status: "working" as const, blocks: [], duty: "night" as const }
        : entry,
    )
    expect(generateScheduleMessage(schedule, settings(), DATE)).toContain(
      "Sis. Ester – Night Duty",
    )
    expect(
      generateScheduleMessage(schedule, settings({ night_duty_label: "Night Shift" }), DATE),
    ).toContain("Sis. Ester – Night Shift")
  })

  it("uses abbreviations, custom labels and comma joining when configured", () => {
    const message = generateScheduleMessage(
      validSchedule(),
      settings({
        message_heading: "Duty — {date}",
        duty_7am_label: "7 AM",
        duty_11am_label: "11 AM",
        gerugambakkam_label: "GKM",
        leave_label: "On leave",
        comp_off_label: "Comp",
        block_joiner: "comma",
        block_abbreviations: {
          [blockList.helpage.id]: "HLP",
          [blockList.cyithiya.id]: "CY",
          [blockList.shanthi.id]: "MHA",
        },
      }),
      DATE,
    )
    expect(message.split("\n")[0]).toBe("Duty — Monday, 9 November 2026")
    expect(message).toContain("Sister Jeeva – Comp")
    expect(message).toContain("Sister Devabakiyam – MHA")
    expect(message).toContain("Sis. Shantha – HLP, CY")
    expect(message).toContain("Sis. Ranjitha – 7 AM")
    expect(message).toContain("Sister Uma – On leave")
    expect(message).not.toContain("Others can continue")
  })

  it("omits people with no duties instead of writing an empty line", () => {
    const message = generateScheduleMessage(
      [assignment(people.uma), assignment(people.deepa, { duty: "11am" })],
      settings({ message_heading: "" }),
      DATE,
    )
    expect(message).toBe("Sis. Deepa – 11:30 AM Duty")
  })
})

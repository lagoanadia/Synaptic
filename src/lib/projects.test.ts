import { describe, expect, it } from "vitest";
import { dueLabel, nextTask, projectState, type TaskItem } from "./projects";

const t = (id: string, status: TaskItem["status"], dueDate: string | null = null, order = 0): TaskItem => ({ id, title: id, status, dueDate, pursuitId: "p", order });

describe("projectState", () => {
  it("is not started, in progress or done from its tasks", () => {
    expect(projectState({ finished: false, tasks: [] })).toBe("todo");
    expect(projectState({ finished: false, tasks: [t("a", "TODO")] })).toBe("todo");
    expect(projectState({ finished: false, tasks: [t("a", "TODO"), t("b", "DONE")] })).toBe("doing");
    expect(projectState({ finished: false, tasks: [t("a", "DONE")] })).toBe("done");
    expect(projectState({ finished: true, tasks: [t("a", "TODO")] })).toBe("done");
  });
});

describe("nextTask", () => {
  it("prefers what's started, then the earliest due", () => {
    expect(nextTask([t("a", "TODO", "2026-11-20"), t("b", "IN_PROGRESS")])?.id).toBe("b");
    expect(nextTask([t("a", "TODO", "2026-11-20"), t("b", "TODO", "2026-11-12"), t("c", "TODO")])?.id).toBe("b");
    expect(nextTask([t("a", "DONE")])).toBeNull();
  });
});

describe("dueLabel", () => {
  it("says it like people do", () => {
    expect(dueLabel("2026-11-09", "2026-11-09")).toEqual({ text: "hoy", late: false });
    expect(dueLabel("2026-11-10", "2026-11-09").text).toBe("mañana");
    expect(dueLabel("2026-11-08", "2026-11-09")).toEqual({ text: "ayer", late: true });
    expect(dueLabel("2026-11-12", "2026-11-09").text).toBe("jue 12");
    expect(dueLabel("2026-12-15", "2026-11-09").text).toBe("15 dic");
  });
});

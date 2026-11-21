import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_CONFIG, driveId, readConfig, resolve, type Candidate } from "./driveAgentPlan";

const config = { ...DEFAULT_AGENT_CONFIG, studentNames: ["Nadia"] };
const c = (id: string, name: string, day: number, extra: Partial<Candidate> & { status?: string } = {}) => ({ id, name, createdAt: new Date(2026, 9, day), ...extra });
const by = (list: ReturnType<typeof resolve>, id: string) => list.find((s) => s.id === id)!;

describe("resolve", () => {
  it("plans new files and waits for approval; applies them when asked", () => {
    const planned = resolve([c("a", "AD-UD2-T9_capa-datos_v3.pptx", 1)], config, false);
    expect(by(planned, "a")).toMatchObject({ status: "planned", target: { folder: ["AD", "UD2"], name: "AD_UD2_T9_Capa_datos.pdf", pdf: true } });
    expect(by(resolve([c("a", "AD-UD2-T9_capa-datos_v3.pptx", 1)], config, true), "a").status).toBe("approved");
  });

  it("several versions of a topic: only the newest original is applied", () => {
    const r = resolve([c("v2", "AD-UD2-T9_capa-datos_v2.pptx", 1), c("v3", "AD-UD2-T9_capa-datos_v3.pdf", 5), c("v1", "AD-UD2-T9_capa-datos.docx", 3)], config, true);
    expect(by(r, "v3").status).toBe("approved");
    expect(by(r, "v2").status).toBe("skipped");
    expect(by(r, "v1").status).toBe("skipped");
  });

  it("the workbook wins the assignment over a newer reading", () => {
    const r = resolve([c("cuad", "PSP-UD2_cuaderno-de-actividades_v2.docx", 1), c("lect", "PSP-UD2_lectura-hilos.pdf", 9)], config, true);
    expect(by(r, "cuad").status).toBe("approved");
    expect(by(r, "lect")).toMatchObject({ status: "skipped", reason: "hay una versión mejor" });
  });

  it("a newer version after one already done gets applied (it replaces it); the done one stays done", () => {
    const r = resolve([c("old", "AD-UD1-T2_nio-file.pptx", 1, { status: "done" }), c("new", "AD-UD1-T2_nio-file_v2.pptx", 4)], config, true);
    expect(by(r, "old").status).toBe("done");
    expect(by(r, "new").status).toBe("approved");
  });

  it("files it can't place wait for the student; overrides fix them", () => {
    expect(by(resolve([c("x", "DIX_A1_Nadia.pdf", 1)], config, true), "x")).toMatchObject({ status: "review", reason: "no-unit" });
    const fixed = resolve([c("x", "DIX_A1_Nadia.pdf", 1)], { ...config, overrides: { x: { unit: 1 } } }, true);
    expect(by(fixed, "x")).toMatchObject({ status: "approved", target: { name: "DIX_UD1_Entrega.pdf" } });
    expect(by(resolve([c("x", "DIX_A1_Nadia.pdf", 1)], { ...config, overrides: { x: { skip: true } } }, true), "x").status).toBe("skipped");
  });

  it("a failed file waits for a retry instead of failing every hour", () => {
    expect(by(resolve([c("e", "AD-UD1-T2_nio-file.pptx", 1, { status: "error" })], config, true), "e").status).toBe("error");
  });

  it("uses the course's subject for names without one", () => {
    expect(by(resolve([c("u", "UD1_T1_ficheros.pptx", 1, { course: "AD" })], config, true), "u").target?.name).toBe("AD_UD1_T1_Ficheros.pdf");
  });
});

describe("helpers", () => {
  it("driveId reads links and bare ids", () => {
    expect(driveId("https://drive.google.com/file/d/1nTfW006UU02UNpm4TvtWuwfuWuUnzYVS/view?usp=sharing")).toBe("1nTfW006UU02UNpm4TvtWuwfuWuUnzYVS");
    expect(driveId("https://drive.google.com/open?id=1nTfW006UU02UNpm4TvtWuwfuWuUnzYVS")).toBe("1nTfW006UU02UNpm4TvtWuwfuWuUnzYVS");
    expect(driveId("1nTfW006UU02UNpm4TvtWuwfuWuUnzYVS")).toBe("1nTfW006UU02UNpm4TvtWuwfuWuUnzYVS");
    expect(driveId("hola")).toBeNull();
  });
  it("readConfig keeps defaults and cleans what it gets", () => {
    const r = readConfig({ studentNames: ["Nadia", "x", 3], aliases: { sge: "SXE" } });
    expect(r.studentNames).toEqual(["Nadia"]);
    expect(r.aliases).toEqual({ SGE: "SXE" });
    expect(readConfig(null).folders.PROY).toBe("Proyecto");
  });
});

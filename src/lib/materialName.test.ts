import { describe, expect, it } from "vitest";
import { DEFAULT_NAMING, normName, parseMaterialName, placeMaterial, statementWins, subjectOf } from "./materialName";

const me = { ...DEFAULT_NAMING, studentNames: ["Nadia", "NadiaLV"] };
const where = (name: string, opts: Parameters<typeof placeMaterial>[1] = {}) => {
  const p = placeMaterial(name, { config: me, ...opts });
  return p.ok ? [...p.folder, p.name].join("/") : `?${p.reason}`;
};

describe("placeMaterial: the student's real files", () => {
  it.each([
    ["AD-UD2-T9_capa-datos_v3.pptx", {}, "AD/UD2/AD_UD2_T9_Capa_datos.pdf"],
    ["AD-UD1-T2_nio-file.pdf", {}, "AD/UD1/AD_UD1_T2_Nio_file.pdf"],
    ["UD1_T1_ficheros.pptx", { courseSubject: "AD" }, "AD/UD1/AD_UD1_T1_Ficheros.pdf"],
    ["SGE-UD2-T2_el-infierno-de-dependencias_v2.pptx", {}, "SXE/UD2/SXE_UD2_T2_Infierno_de_dependencias.pdf"],
    ["PSP-UD2_cuaderno-de-actividades_v2.docx", {}, "PSP/UD2/Entrega/PSP_UD2_Enunciado.pdf"],
    ["DI-UD2_codigo-de-referencia.zip", {}, "DI/UD2/Entrega/Código/DI_UD2_Codigo.zip"],
    ["PSP-UD2-A3_interbloqueo-sembrado.zip", {}, "PSP/UD2/Entrega/Código/PSP_UD2_Codigo_A3.zip"],
    ["DIX_UD5_Entrega_NadiaLV.pdf", {}, "DIX/UD5/Entrega/DIX_UD5_Entrega.pdf"],
    ["DIUD2AD_Nadia.pdf", {}, "DI/UD2/Entrega/DI_UD2_Entrega.pdf"],
    ["PMDMUD1_NadiaLV.pdf", {}, "PMDM/UD1/Entrega/PMDM_UD1_Entrega.pdf"],
    ["DIX_A1_Nadia.pdf", { unit: 1 }, "DIX/UD1/Entrega/DIX_UD1_Entrega.pdf"],
  ] as const)("%s → %s", (name, opts, out) => {
    expect(where(name, opts)).toBe(out);
  });

  it("Proyecto's sessions go to Sesiones", () => {
    expect(where("PT-CHIOS-S01_necesidades-al-producto-minimo.pptx")).toBe("Proyecto/Sesiones/PROY_S01_Necesidades_al_producto_minimo.pdf");
  });
  it("ignores (1) and version tags", () => {
    expect(where("AD-UD2-T9_capa-datos (1).pptx")).toBe("AD/UD2/AD_UD2_T9_Capa_datos.pdf");
    expect(parseMaterialName("AD-UD2-T9_capa-datos_v3.pptx")?.version).toBe(3);
  });
  it("asks when it can't tell", () => {
    expect(where("DIX_A1_Nadia.pdf")).toBe("?no-unit");
    expect(where("apuntes-sueltos.pdf")).toBe("?no-subject");
    expect(where("AD_lecturas-recomendadas.pdf")).toBe("?no-unit");
  });
  it("a file handed in through Classroom is the submission whatever its name", () => {
    expect(where("mi-trabajo.pdf", { courseSubject: "SXE", unit: 2, submission: true })).toBe("SXE/UD2/Entrega/SXE_UD2_Entrega.pdf");
  });
});

describe("statementWins", () => {
  const d = (s: string) => new Date(s);
  it("the workbook always wins; readings never replace the assignment", () => {
    expect(statementWins({ isWorkbook: true, createdAt: d("2026-01-01") }, { isWorkbook: false, createdAt: d("2026-02-01") })).toBe(true);
    expect(statementWins({ isWorkbook: false, createdAt: d("2026-03-01") }, { isWorkbook: true, createdAt: d("2026-02-01") })).toBe(false);
    expect(statementWins({ isWorkbook: false, createdAt: d("2026-03-01") }, { isWorkbook: false, createdAt: d("2026-02-01") })).toBe(false);
    expect(statementWins({ isWorkbook: true, createdAt: d("2026-03-01") }, { isWorkbook: true, createdAt: d("2026-02-01") })).toBe(true);
    expect(statementWins({ isWorkbook: false, createdAt: d("2026-03-01") }, null)).toBe(true);
  });
});

describe("normName", () => {
  it("matches Drive folders with emoji and spaces", () => {
    expect(normName("📌 AD")).toBe("AD");
    expect(normName("📌DI")).toBe("DI");
    expect(normName("Itinerario II")).toBe("ITINERARIOII");
    expect(normName("Inglés")).toBe("INGLES");
  });
});

describe("subjectOf", () => {
  it("matches a Synaptic folder to its subject by code or Drive folder name", () => {
    expect(subjectOf("AD", DEFAULT_NAMING.folders)).toBe("AD");
    expect(subjectOf("📌 PMDM", DEFAULT_NAMING.folders)).toBe("PMDM");
    expect(subjectOf("Proyecto", DEFAULT_NAMING.folders)).toBe("PROY");
    expect(subjectOf("Itinerario II", DEFAULT_NAMING.folders)).toBe("IT2");
    expect(subjectOf("Larder", DEFAULT_NAMING.folders)).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// upsertSection isn't a pure function — it talks to the database — so
// instead of running it against a real Postgres, we replace `prisma`
// with a fake object whose methods are just vi.fn() spies we control.
// This tests the function's *logic* (reuse an existing section vs.
// append a new one at the end of the order) without needing Postgres
// running at all.
const findUnique = vi.fn();
const aggregate = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    section: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      aggregate: (...args: unknown[]) => aggregate(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

const { upsertSection } = await import("./sections");

beforeEach(() => {
  findUnique.mockReset();
  aggregate.mockReset();
  create.mockReset();
});

describe("upsertSection", () => {
  it("returns the existing section and never calls create", async () => {
    findUnique.mockResolvedValue({ id: "s1", userId: "u1", name: "Escuela", order: 2 });

    const result = await upsertSection("u1", "Escuela");

    expect(result).toEqual({ id: "s1", userId: "u1", name: "Escuela", order: 2 });
    expect(create).not.toHaveBeenCalled();
  });

  it("trims the name before looking it up", async () => {
    findUnique.mockResolvedValue({ id: "s1", userId: "u1", name: "Escuela", order: 0 });

    await upsertSection("u1", "  Escuela  ");

    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_name: { userId: "u1", name: "Escuela" } },
    });
  });

  it("creates a new section appended after the current max order", async () => {
    findUnique.mockResolvedValue(null);
    aggregate.mockResolvedValue({ _max: { order: 4 } });
    create.mockResolvedValue({ id: "s2", userId: "u1", name: "Trabajo", order: 5 });

    const result = await upsertSection("u1", "Trabajo");

    expect(create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "Trabajo", order: 5 },
    });
    expect(result.order).toBe(5);
  });

  it("starts at order 0 for a user's very first section", async () => {
    findUnique.mockResolvedValue(null);
    aggregate.mockResolvedValue({ _max: { order: null } });
    create.mockResolvedValue({ id: "s3", userId: "u1", name: "Primero", order: 0 });

    await upsertSection("u1", "Primero");

    expect(create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "Primero", order: 0 },
    });
  });
});

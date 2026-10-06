import { groupByStable } from "./practice";

describe("groupByStable", () => {
  it("groups items by key and preserves order", () => {
    const items = [
      { id: 1, status: "open" },
      { id: 2, status: "closed" },
      { id: 3, status: "open" },
    ];

    const result = groupByStable(items, (item) => item.status);

    expect(result).toEqual({
      open: [
        { id: 1, status: "open" },
        { id: 3, status: "open" },
      ],
      closed: [{ id: 2, status: "closed" }],
    });
  });

  it("ignores null, undefined, and empty-string keys", () => {
    const items = [
      { id: 1, key: "alpha" },
      { id: 2, key: "" },
      { id: 3, key: null as string | null },
      { id: 4, key: undefined as string | undefined },
      { id: 5, key: "beta" },
    ];

    const result = groupByStable(items, (item) => item.key);

    expect(result).toEqual({
      alpha: [{ id: 1, key: "alpha" }],
      beta: [{ id: 5, key: "beta" }],
    });
  });

  it("returns empty object when all keys are invalid", () => {
    const items = [
      { id: 1, key: "" },
      { id: 2, key: null as string | null },
      { id: 3, key: undefined as string | undefined },
    ];

    const result = groupByStable(items, (item) => item.key);

    expect(result).toEqual({});
  });
});

import { getRampAndDrawNames } from "./tagLookup";

const mockStore: Record<string, unknown> = {};

jest.mock("localforage", () => ({
  createInstance: () => ({
    getItem: async (key: string) => mockStore[key] ?? null,
    setItem: async (key: string, value: unknown) => {
      mockStore[key] = value;
      return value;
    },
  }),
}));

function page(
  data: { name: string }[],
  next: string | null,
): { ok: true; status: 200; json: () => Promise<unknown> } {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data, has_more: next !== null, next_page: next }),
  };
}

describe("getRampAndDrawNames", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) delete mockStore[key];
  });

  it("follows pagination and lowercases / splits DFC names", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        page([{ name: "Sol Ring" }], "https://api.scryfall.com/next"),
      )
      .mockResolvedValueOnce(
        page(
          [
            { name: "Malevolent Rumble" },
            { name: "Bala Ged Recovery // Bala Ged Sanctuary" },
          ],
          null,
        ),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const names = await getRampAndDrawNames();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(names).toEqual(
      new Set([
        "sol ring",
        "malevolent rumble",
        "bala ged recovery",
        "bala ged sanctuary",
      ]),
    );
  });

  it("serves a fresh cache without hitting the network", async () => {
    mockStore["ramp-and-draw"] = {
      fetchedAt: Date.now(),
      names: ["sol ring"],
    };
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const names = await getRampAndDrawNames();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(names).toEqual(new Set(["sol ring"]));
  });

  it("falls back to a stale cache when the refresh fails", async () => {
    mockStore["ramp-and-draw"] = { fetchedAt: 0, names: ["old card"] };
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const names = await getRampAndDrawNames();

    expect(names).toEqual(new Set(["old card"]));
  });
});

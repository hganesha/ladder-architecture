import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

const localValues = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => localValues.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localValues.set(key, String(value));
    },
    removeItem: (key: string) => {
      localValues.delete(key);
    },
    clear: () => localValues.clear(),
    key: (index: number) => [...localValues.keys()][index] ?? null,
    get length() {
      return localValues.size;
    },
  } satisfies Storage,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

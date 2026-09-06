import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { themeBootstrapScript, themeStorageKey } from "../lib/theme.mjs";

function bootstrap(saved, deviceDark, blocked = false) {
  const root = { dataset: {}, style: {} };
  let chrome;
  runInNewContext(themeBootstrapScript, {
    document: {
      documentElement: root,
      querySelector(selector) {
        assert.equal(selector, 'meta[name="theme-color"]');
        return {
          setAttribute(name, value) {
            assert.equal(name, "content");
            chrome = value;
          },
        };
      },
    },
    window: {
      localStorage: {
        getItem(key) {
          assert.equal(key, themeStorageKey);
          if (blocked) throw new Error("Storage unavailable");
          return saved;
        },
      },
      matchMedia(query) {
        assert.equal(query, "(prefers-color-scheme: dark)");
        return { matches: deviceDark };
      },
    },
  });
  return {
    mode: root.dataset.themeMode,
    theme: root.dataset.theme,
    controls: root.style.colorScheme,
    chrome,
  };
}

test("first visit and System preference follow the device before page content renders", () => {
  for (const saved of [null, "system"])
    for (const dark of [false, true]) {
      const theme = dark ? "dark" : "light";
      assert.deepEqual(bootstrap(saved, dark), {
        mode: "system",
        theme,
        controls: theme,
        chrome: dark ? "#101c22" : "#f6f8f8",
      });
    }
});

test("saved Light or Dark preference overrides the device, including native controls", () => {
  for (const mode of ["light", "dark"])
    for (const deviceDark of [false, true])
      assert.deepEqual(bootstrap(mode, deviceDark), {
        mode,
        theme: mode,
        controls: mode,
        chrome: mode === "dark" ? "#101c22" : "#f6f8f8",
      });
});

test("unavailable storage and invalid saved preferences fall back to the device", () => {
  assert.deepEqual(bootstrap(null, true, true), {
    mode: "system",
    theme: "dark",
    controls: "dark",
    chrome: "#101c22",
  });
  for (const saved of ["", "legacy", "DARK", "<script>", undefined])
    assert.deepEqual(bootstrap(saved, false), {
      mode: "system",
      theme: "light",
      controls: "light",
      chrome: "#f6f8f8",
    });
});

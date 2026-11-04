import assert from "node:assert/strict";
import test from "node:test";
import { createLocale } from "../lib/locale/index.mjs";
import { isLocale, resolveLocale } from "../lib/locale/preferences.mjs";

test("a saved account choice wins without treating a browser locale as a saved preference", () => {
  assert.equal(resolveLocale({ account: "es", device: "en-GB", languages: ["pt-PT"] }), "es");
  assert.equal(resolveLocale({ account: null, device: "en-GB", languages: ["pt-PT"] }), "en-GB");
  assert.equal(resolveLocale({ account: "fr", device: "pt-BR", languages: ["fr-FR", "es-MX"] }), "es");
  assert.equal(resolveLocale({ languages: ["pt-BR", "en-US"] }), "pt-PT");
  assert.equal(resolveLocale({ languages: ["fr-FR"] }), "en-GB");
  assert.equal(isLocale("__proto__"), false);
  assert.equal(isLocale("pt-BR"), false);
});

test("translated forecast timestamps still use the spot timezone", () => {
  const pt = createLocale("pt-PT");
  const timestamp = "2026-07-01T23:15:00Z";
  const time = pt.formatDate(timestamp, {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
  });
  assert.equal(pt.t("forecast.updated", { date: time }), "Atualizado em 00:15");
  assert.equal(pt.formatNumber(1.5), "1,5");
  assert.equal(createLocale("fr").t("login.title"), "Log in");
});

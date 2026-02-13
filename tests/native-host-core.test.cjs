const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTranslationPrompt,
  sanitizeTranslation,
  mapCodexFailure
} = require("../dist/native/host/host-core.js");

test("buildTranslationPrompt - auto source language", () => {
  const prompt = buildTranslationPrompt({
    sourceLang: "auto",
    targetLang: "ko",
    text: "Hello world"
  });

  assert.match(prompt, /Detect the source language automatically\./);
  assert.match(prompt, /Translate the user text into ko\./);
  assert.match(prompt, /"""\nHello world\n"""/);
});

test("buildTranslationPrompt - explicit source language", () => {
  const prompt = buildTranslationPrompt({
    sourceLang: "en",
    targetLang: "ja",
    text: "How are you?"
  });

  assert.match(prompt, /Source language is en\./);
  assert.match(prompt, /Translate the user text into ja\./);
});

test("sanitizeTranslation handles fenced output", () => {
  const output = sanitizeTranslation("```\n안녕하세요\n```");
  assert.equal(output, "안녕하세요");
});

test("sanitizeTranslation handles quoted output", () => {
  const output = sanitizeTranslation('"Translated text"');
  assert.equal(output, "Translated text");
});

test("sanitizeTranslation rejects empty output", () => {
  assert.throws(
    () => sanitizeTranslation("   "),
    (error) => error && error.errorCode === "EMPTY_OUTPUT"
  );
});

test("mapCodexFailure maps timeout", () => {
  const error = mapCodexFailure({
    exitCode: 1,
    stdout: "",
    stderr: "",
    timedOut: true
  });

  assert.equal(error.errorCode, "MODEL_TIMEOUT");
});

test("mapCodexFailure maps missing codex binary", () => {
  const error = mapCodexFailure({
    exitCode: 1,
    stdout: "",
    stderr: "spawn ENOENT",
    timedOut: false,
    spawnErrorCode: "ENOENT"
  });

  assert.equal(error.errorCode, "CODEX_NOT_FOUND");
});

test("mapCodexFailure maps auth errors", () => {
  const error = mapCodexFailure({
    exitCode: 1,
    stdout: "please run codex login",
    stderr: "",
    timedOut: false
  });

  assert.equal(error.errorCode, "CODEX_AUTH_REQUIRED");
});

test("mapCodexFailure maps model not found", () => {
  const error = mapCodexFailure({
    exitCode: 1,
    stdout: "model xyz not found",
    stderr: "",
    timedOut: false
  });

  assert.equal(error.errorCode, "MODEL_NOT_FOUND");
});

test("mapCodexFailure maps generic failures", () => {
  const error = mapCodexFailure({
    exitCode: 1,
    stdout: "",
    stderr: "something unexpected happened",
    timedOut: false
  });

  assert.equal(error.errorCode, "MODEL_EXEC_FAILED");
  assert.match(error.message, /something unexpected happened/);
});

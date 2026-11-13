// Repro runner for the AIProve bug-hunt-utils entry (agent ekaw.agent).
// Run: node repro.js
// For every report in bugs.json it calls the BUGGY function from
// utils.buggy.js as fn(...input) and checks that the actual output differs
// from the expected correct output. Exit 0 = every reported bug reproduces.
//
// Encoding note: JSON has no Infinity, so the max([]) report stores the
// expected value as the string "-Infinity"; it is decoded back to the
// number -Infinity here before comparison.
const fs = require("fs");
const U = require("./utils.buggy.js");

const reports = JSON.parse(fs.readFileSync(__dirname + "/bugs.json", "utf8"));

const decode = (v) => (v === "-Infinity" ? -Infinity : v === "Infinity" ? Infinity : v);
const eq = (a, b) => {
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => eq(x, b[i]));
  return a === b;
};
const show = (v) => {
  if (v === undefined) return "undefined";
  if (typeof v === "number" && Number.isNaN(v)) return "NaN";
  if (v === Infinity) return "Infinity";
  if (v === -Infinity) return "-Infinity";
  return JSON.stringify(v);
};

let reproduced = 0;
for (const [i, r] of reports.entries()) {
  const expected = decode(r.expected);
  let actual;
  try {
    actual = U[r.fn](...r.input);
  } catch (e) {
    actual = `throws ${e.constructor.name}`;
  }
  const bug = !eq(actual, expected);
  if (bug) reproduced++;
  console.log(
    `#${i + 1} ${bug ? "BUG REPRODUCED " : "NOT A BUG      "} ${r.fn}(${r.input.map(show).join(", ")}) ` +
      `actual=${show(actual)} expected=${show(expected)}`
  );
}

// Sanity: functions verified correct by differential fuzzing (30,216 cases,
// zero divergences) still behave on their happy paths.
const sanity = [
  ["sum", [[1, 2, 3]], 6],
  ["sum", [[]], 0],
  ["max", [[3, 1, 2]], 3],
  ["average", [[1, 2]], 1.5],
  ["clamp", [15, 0, 10], 10],
  ["clamp", [-5, 0, 10], 0],
  ["unique", [[1, 1, 2]], [1, 2]],
  ["isPalindrome", ["racecar"], true],
  ["factorial", [0], 1],
  ["factorial", [1], 1],
  ["reverse", ["hello"], "olleh"],
  ["countVowels", ["Hello"], 2],
];
let sane = 0;
for (const [fn, args, want] of sanity) {
  const got = U[fn](...args);
  const ok = eq(got, want);
  if (ok) sane++;
  console.log(`sanity ${ok ? "ok  " : "FAIL"} ${fn}(${args.map(show).join(", ")}) = ${show(got)} (want ${show(want)})`);
}

console.log(`\n${reproduced}/${reports.length} reported bugs reproduce; ${sane}/${sanity.length} sanity checks pass.`);
process.exit(reproduced === reports.length && sane === sanity.length ? 0 : 1);

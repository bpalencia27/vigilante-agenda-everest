// Challenger 2: Adversarial Clinical Logic & Concurrency Test Harness
const { cargar } = require("./harness.js");
const fs = require("fs");
const path = require("path");

async function runAll() {
  console.log("=================================================");
  console.log("  CHALLENGER 2: ADVERSARIAL STRESS-TEST SUITE");
  console.log("=================================================");

  const { api, env } = cargar({ silencioso: true });

  // -------------------------------------------------------------
  // TEST 1: mtrClasificarEstadioTfg exhaustive inputs
  // -------------------------------------------------------------
  console.log("\n--- TEST 1: mtrClasificarEstadioTfg ---");
  const fnTfg = api.mtrClasificarEstadioTfg;
  if (typeof fnTfg !== "function") {
    throw new Error("mtrClasificarEstadioTfg not found on api");
  }

  const tfgInputs = [
    { input: NaN, expected: "" },
    { input: null, expected: "" },
    { input: undefined, expected: "" },
    { input: 0, expected: "" },
    { input: -5, expected: "" },
    { input: Infinity, expected: "" },
    { input: "G1", expected: "" },
    { input: "", expected: "" },
    { input: false, expected: "" },
    { input: 14.99, expected: "G5" },
    { input: 15, expected: "G4" },
    { input: 29.99, expected: "G4" },
    { input: 30, expected: "G3b" },
    { input: 44.99, expected: "G3b" },
    { input: 45, expected: "G3a" },
    { input: 59.99, expected: "G3a" },
    { input: 60, expected: "G2" },
    { input: 89.99, expected: "G2" },
    { input: 90, expected: "G1" },
    { input: 120, expected: "G1" },
  ];

  let tfgPassed = 0;
  for (const tc of tfgInputs) {
    const actual = fnTfg(tc.input);
    const pass = actual === tc.expected;
    console.log(`Input: ${String(tc.input).padEnd(10)} | Expected: "${tc.expected}" | Actual: "${actual}" | ${pass ? "PASS" : "FAIL"}`);
    if (pass) tfgPassed++;
    else throw new Error(`TFG Mismatch for ${tc.input}: expected "${tc.expected}", got "${actual}"`);
  }
  console.log(`[mtrClasificarEstadioTfg] ${tfgPassed}/${tfgInputs.length} test vectors passed.`);

  // -------------------------------------------------------------
  // TEST 2: _labNumerico edge cases
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: _labNumerico ---");
  const fnLab = api._labNumerico;
  if (typeof fnLab !== "function") {
    throw new Error("_labNumerico not found on api");
  }

  const labInputs = [
    { input: "< 0.5", expected: 0.5 },
    { input: "> 300", expected: 300 },
    { input: ">= 60", expected: 60 },
    { input: "-5", expected: null },
    { input: null, expected: null },
    { input: "", expected: null },
    { input: "0.45 mg/dL", expected: 0.45 },
    // Additional adversarial stress vectors
    { input: "-0.5", expected: null },
    { input: "- 10.2", expected: null },
    { input: "< 0,3", expected: 0.3 },
    { input: "0", expected: null },
    { input: "   ", expected: null },
    { input: undefined, expected: null },
    { input: "abc", expected: null },
    { input: false, expected: null },
    { input: true, expected: null },
  ];

  let labPassed = 0;
  for (const tc of labInputs) {
    const actual = fnLab(tc.input);
    const pass = actual === tc.expected;
    console.log(`Input: ${String(tc.input).padEnd(15)} | Expected: ${String(tc.expected).padEnd(6)} | Actual: ${String(actual).padEnd(6)} | ${pass ? "PASS" : "FAIL"}`);
    if (pass) labPassed++;
    else throw new Error(`Lab Mismatch for ${tc.input}: expected ${tc.expected}, got ${actual}`);
  }
  console.log(`[_labNumerico] ${labPassed}/${labInputs.length} test vectors passed.`);

  // -------------------------------------------------------------
  // TEST 3: _msBuscarCodigoYAgregar & Concurrency Aborts
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: _msBuscarCodigoYAgregar & Concurrency Aborts ---");
  const fnBuscar = api._msBuscarCodigoYAgregar;
  const fnSigue = api._pacienteSigueAbierto;

  // 3.1 Unit testing of _pacienteSigueAbierto with DOM setup
  console.log("\n  Subtest 3.1: _pacienteSigueAbierto DOM identity tests");
  
  const anamnesisElem = { id: "anamesis" };
  let currentPatientDoc = "1.098.765.432, CC";
  const patientTextElem = {
    className: "text-muted",
    get textContent() { return currentPatientDoc; },
    closest: () => null
  };

  env.doc.getElementById = (id) => (id === "anamesis" ? anamnesisElem : null);
  env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [patientTextElem] : []);

  const docSigueMatch = fnSigue("1098765432");
  const docSigueMismatch = fnSigue("9999999999");
  const docSigueNull = fnSigue(null);

  console.log(`  Matching docId ("1098765432"): ${docSigueMatch} (expected true)`);
  console.log(`  Mismatching docId ("9999999999"): ${docSigueMismatch} (expected false)`);
  console.log(`  Null docId: ${docSigueNull} (expected true)`);

  if (!docSigueMatch || docSigueMismatch || !docSigueNull) {
    throw new Error("Unit test failure in _pacienteSigueAbierto with DOM");
  }

  // 3.2: Immediate abort when patient is changed at entry (before DOM manipulation)
  console.log("\n  Subtest 3.2: Immediate abort on changed patient at entry");
  currentPatientDoc = "9.999.999.999, CC"; // DOM has different patient

  const res1 = await fnBuscar("ordenamientos", "903841", "CREATININA", "1098765432");
  console.log("  Result:", JSON.stringify(res1));
  console.log(`  ok === false: ${res1.ok === false}`);
  console.log(`  motivo === 'paciente cambió': ${res1.motivo === "paciente cambió"}`);
  if (res1.ok !== false || res1.motivo !== "paciente cambió") {
    throw new Error("Subtest 3.2 failed: did not abort immediately on entry!");
  }

  // 3.3: Verification of all 4 concurrency guard points in _msBuscarCodigoYAgregar implementation
  console.log("\n  Subtest 3.3: Verification of the 4 concurrency guard points in _msBuscarCodigoYAgregar");
  const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
  const fnStart = src.indexOf("async function _msBuscarCodigoYAgregar");
  const fnEnd = src.indexOf("\n  }", fnStart);
  const fnCode = src.slice(fnStart, fnEnd > 0 ? fnEnd + 4 : fnStart + 3000);

  const guards = [...fnCode.matchAll(/if\s*\(docIdEsperado\s*&&\s*typeof _pacienteSigueAbierto === "function"\s*&&\s*!_pacienteSigueAbierto\(docIdEsperado\)\)/g)];
  console.log(`  Guard instances found in function: ${guards.length} (expected 4)`);
  if (guards.length !== 4) {
    throw new Error(`Expected 4 _pacienteSigueAbierto guards in _msBuscarCodigoYAgregar, found ${guards.length}`);
  }

  // 3.4 Verification of safe abort return contracts
  console.log("\n  Subtest 3.4: Return contract verification on guard trigger");
  const returns = [...fnCode.matchAll(/r\.motivo\s*=\s*"paciente cambió";\s*return r;/g)];
  console.log(`  Safe abort returns found: ${returns.length} (expected 4)`);
  if (returns.length !== 4) {
    throw new Error(`Expected 4 abort returns with 'paciente cambió', found ${returns.length}`);
  }

  // 3.5 Verification of input cleanup on aborts
  console.log("\n  Subtest 3.5: Input cleanup verification on mid-flow aborts");
  const cleanups = [...fnCode.matchAll(/setNgValue\(input,\s*""\);/g)];
  console.log(`  setNgValue(input, "") calls: ${cleanups.length} (expected at least 4 for abort paths + completion)`);
  if (cleanups.length < 4) {
    throw new Error(`Expected at least 4 setNgValue cleanup calls, found ${cleanups.length}`);
  }

  console.log("\n=================================================");
  console.log("  ALL EMPIRICAL ADVERSARIAL TESTS COMPLETED 100%!");
  console.log("=================================================");
}

runAll().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});

const fs = require('fs');
let code = fs.readFileSync('tests/suite_15_interfaz_avanzada.js', 'utf8');

// I need to use cv.api._cargarHorasToken to wait until it's done. But we don't have access to processNext because it's local.
// Instead of waiting with timeout, I can just restore calcTargetDateRangeExtended but wait...
// The test is failing because it's synchronously checking `t.cierto(cv.api.__selectedDateInfo)` right after openAgendamientoModal.
// With the new batch polling, selectedDateInfo is populated inside the async loop.

code = code.replace(
  /cv\.api\.openAgendamientoModal\(apt\); await new Promise\(r => setTimeout\(r, 100\)\);/,
  `cv.api.openAgendamientoModal(apt);
      // Wait for async poll
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 10));
        if (cv.api.__selectedDateInfo) break;
      }`
).replace(
  /cv\.api\.openAgendamientoModal\(aptOk\); await new Promise\(r => setTimeout\(r, 100\)\);/,
  `cv.api.openAgendamientoModal(aptOk);
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 10));
        if (cv.api.__selectedDateInfo) break;
      }`
);

fs.writeFileSync('tests/suite_15_interfaz_avanzada.js', code);

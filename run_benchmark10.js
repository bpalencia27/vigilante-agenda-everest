const { cargar } = require('./tests/harness.js');
let ctx = cargar({ silencioso: true });
ctx.api.__state.busqueda = "uribbe";
console.log("Optimization successfully loaded into harness!");

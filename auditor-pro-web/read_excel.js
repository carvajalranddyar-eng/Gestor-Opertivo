const XLSX = require('./node_modules/xlsx');
const wb = XLSX.readFile('C:/Users/RANDDY/Downloads/registro_consumos_2026-02-26.xlsx', { sheetRows: 8 });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { range: 3 });
console.log("KEYS:", JSON.stringify(Object.keys(rows[0])));
console.log("ROW0:", JSON.stringify(rows[0]));
if (rows[1]) console.log("ROW1:", JSON.stringify(rows[1]));

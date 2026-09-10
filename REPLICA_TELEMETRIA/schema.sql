-- VIGILANTE DE AGENDA — Esquema D1 de la réplica de telemetría
-- =============================================================
-- Espejo de las hojas del tablero Google Sheets (Codigo.gs) con dos mejoras
-- deliberadas, ambas documentadas en README.md:
--   1. dedup PERMANENTE por lote (columna `lotes`) — el GAS deduplicaba solo
--      6 h por caché y la duplicación histórica llegó al 54 % (auditoría 07-sep).
--   2. fechas/versiones como TEXTO puro (recibido = ISO) — D1 no auto-convierte
--      "18.6.1" en fecha, el defecto de Sheets desaparece.
--
-- Aplicar con:  wrangler d1 execute <db> --file=schema.sql
-- La tabla `acceso` la llena el DUEÑO a mano (INSERTs), como la hoja "acceso".

-- Lotes ya recibidos. El dedup ES esta tabla: INSERT OR IGNORE sobre el índice
-- único; un lote que ya entró responde "dup" (cuenta como entrega buena) y el
-- cliente deja de reintentarlo. Los NULL (cuerpo sin lote) no chocan con el
-- índice único de SQLite: entran sin dedup, como en el GAS.
CREATE TABLE IF NOT EXISTS lotes (
  lote     TEXT,
  recibido TEXT NOT NULL,          -- ISO, puesto por el worker
  evento   TEXT NOT NULL,
  CONSTRAINT uq_lote UNIQUE (lote)
);
CREATE INDEX IF NOT EXISTS idx_lotes_recibido ON lotes (recibido);

-- uso: un resumen de acciones por envío (como la hoja "uso").
CREATE TABLE IF NOT EXISTS uso (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido TEXT NOT NULL,
  ts       TEXT,                   -- reloj del emisor, saneado
  dia      TEXT,
  equipo   TEXT,
  ver      TEXT,                   -- texto puro, sin apóstrofo
  lote     TEXT,
  deDia    TEXT,
  desde    TEXT,
  n        REAL,                   -- total RECALCULADO en el servidor
  acciones TEXT                    -- JSON re-saneado (tope 120 claves + _recortadas)
);
CREATE INDEX IF NOT EXISTS idx_uso_dia ON uso (dia);
CREATE INDEX IF NOT EXISTS idx_uso_equipo ON uso (equipo);

-- uso_detalle: una fila por acción (como la hoja "uso_detalle").
CREATE TABLE IF NOT EXISTS uso_detalle (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido TEXT NOT NULL,
  dia      TEXT,
  equipo   TEXT,
  ver      TEXT,
  accion   TEXT,
  conteo   REAL
);
CREATE INDEX IF NOT EXISTS idx_uso_detalle_accion ON uso_detalle (accion);

-- resumen: cifras del día (como la hoja "resumen").
CREATE TABLE IF NOT EXISTS resumen (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido     TEXT NOT NULL,
  ts           TEXT,
  dia          TEXT,
  equipo       TEXT,
  ver          TEXT,
  lote         TEXT,
  deDia        TEXT,
  fraude       REAL,
  inasistencia REAL,
  atiempo      REAL,
  ultima       REAL
);

-- fraude: avisos de extemporáneas anónimos (como la hoja "fraude").
CREATE TABLE IF NOT EXISTS fraude (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido TEXT NOT NULL,
  ts       TEXT,
  dia      TEXT,
  equipo   TEXT,
  ver      TEXT,
  lote     TEXT,
  deDia    TEXT,
  hora     TEXT,
  min      REAL
);
CREATE INDEX IF NOT EXISTS idx_fraude_dia ON fraude (dia);

-- error: fallos internos reportados por el cliente (como la hoja "error").
-- msg/donde/migas llegan pasados por la barrera _sinDigitosLargos del worker.
CREATE TABLE IF NOT EXISTS error (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido TEXT NOT NULL,
  ts       TEXT,
  dia      TEXT,
  equipo   TEXT,
  ver      TEXT,
  lote     TEXT,
  origen   TEXT,
  msg      TEXT,
  donde    TEXT,
  migas    TEXT
);

-- entorno: navegador/sistema de la flota (como la hoja "entorno").
CREATE TABLE IF NOT EXISTS entorno (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido TEXT NOT NULL,
  ts       TEXT,
  dia      TEXT,
  equipo   TEXT,
  ver      TEXT,
  lote     TEXT,
  deDia    TEXT,
  nav      TEXT,
  so       TEXT,
  zona     TEXT,
  pantalla TEXT,
  gestor   TEXT
);

-- acceso_uid: inicios de sesión (como la hoja "acceso_uid"). La identidad del
-- login de Everest es dato de PERSONAL, no PHI de pacientes; el worker redacta
-- igualmente toda tira de 6+ dígitos del nombre por la barrera común.
CREATE TABLE IF NOT EXISTS acceso_uid (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido TEXT NOT NULL,
  ts       TEXT,
  dia      TEXT,
  equipo   TEXT,
  ver      TEXT,
  lote     TEXT,
  uid      REAL,
  nombre   TEXT,
  perfil   TEXT
);

-- acceso_deneg: intentos de login bloqueados (como la hoja "acceso_deneg").
CREATE TABLE IF NOT EXISTS acceso_deneg (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido TEXT NOT NULL,
  ts       TEXT,
  dia      TEXT,
  equipo   TEXT,
  ver      TEXT,
  lote     TEXT,
  uid      REAL,
  perfil   TEXT,
  cuentas  TEXT
);

-- prueba: latido de vida (como la hoja "prueba"): solo comunes.
CREATE TABLE IF NOT EXISTS prueba (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  recibido TEXT NOT NULL,
  ts       TEXT,
  dia      TEXT,
  equipo   TEXT,
  ver      TEXT,
  lote     TEXT
);

-- acceso: el padrón que el DUEÑO edita a mano (como la hoja "acceso" del GAS).
-- Columnas idénticas a la hoja: perfil | uid | nombre | estado | motivo | caps.
--   perfil: COMPLETO o LABORATORIOS (en mayúsculas; "#..." se salta)
--   estado: vacío/activo → lista de acceso; bloqueado/inactivo → blocklist
--   caps:   separadas por coma, en minúsculas
--   uid:    número; si va vacío el worker deriva uno sintético estable del nombre
CREATE TABLE IF NOT EXISTS acceso (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  perfil  TEXT NOT NULL,
  uid     TEXT,
  nombre  TEXT NOT NULL,
  estado  TEXT DEFAULT '',
  motivo  TEXT DEFAULT '',
  caps    TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_acceso_perfil ON acceso (perfil);

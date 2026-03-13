const { Client } = require('pg');

const SQL = `
-- 1. ODTs
CREATE TABLE IF NOT EXISTS odts (
  id bigserial primary key,
  codigo_barras text unique,
  numero text,
  cliente text,
  direccion text,
  titular text,
  localidad text,
  estado text,
  tipo_servicio text,
  cuadrilla_id text,
  cuadrilla_nombre text,
  fecha_ingreso text,
  fecha_asignacion text,
  medidor_serie text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

-- 2. Fotos (solo URLs, sin guardar imágenes)
CREATE TABLE IF NOT EXISTS fotos (
  id bigserial primary key,
  odt_codigo text references odts(codigo_barras),
  tipo_pieza text,
  url_s3 text,
  fecha_foto text,
  creado_en timestamptz default now()
);

-- 3. Consumos
CREATE TABLE IF NOT EXISTS consumos (
  id bigserial primary key,
  odt_codigo text,
  producto_codigo text,
  producto_descripcion text,
  cantidad integer,
  series text,
  cuadrilla_codigo text,
  cuadrilla_descripcion text,
  fecha_consumo text,
  creado_en timestamptz default now()
);

-- 4. Stock Obrador
CREATE TABLE IF NOT EXISTS stock_obrador (
  id bigserial primary key,
  cuadrilla_codigo text,
  cuadrilla_nombre text,
  producto_codigo text,
  serie text,
  odt_asignada text,
  fecha_entrega text,
  creado_en timestamptz default now()
);

-- 5. Hallazgos
CREATE TABLE IF NOT EXISTS hallazgos (
  id bigserial primary key,
  odt_codigo text,
  tipo_hallazgo text,
  descripcion text,
  severidad text,
  fuente_1 text,
  fuente_2 text,
  confirmado boolean default false,
  resuelto boolean default false,
  creado_en timestamptz default now()
);

-- 6. Auditoría IA
CREATE TABLE IF NOT EXISTS auditoria_ia (
  id bigserial primary key,
  odt_codigo text unique,
  estado text,
  confianza integer,
  medidor_serie_foto text,
  medidor_serie_sistema text,
  coincide boolean,
  caja_presente boolean,
  precinto_presente boolean,
  hallazgos_ia jsonb,
  requiere_humano boolean,
  motivo_humano text,
  analizado_en timestamptz default now()
);

-- 7. Log de sincronizaciones
CREATE TABLE IF NOT EXISTS sincronizaciones (
  id bigserial primary key,
  tipo text,
  inicio timestamptz,
  fin timestamptz,
  odts_procesadas integer default 0,
  consumos_procesados integer default 0,
  errores integer default 0,
  estado text,
  detalle jsonb
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_odts_codigo ON odts(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_consumos_odt ON consumos(odt_codigo);
CREATE INDEX IF NOT EXISTS idx_fotos_odt ON fotos(odt_codigo);
CREATE INDEX IF NOT EXISTS idx_hallazgos_odt ON hallazgos(odt_codigo);
CREATE INDEX IF NOT EXISTS idx_stock_cuadrilla ON stock_obrador(cuadrilla_codigo);
CREATE INDEX IF NOT EXISTS idx_stock_serie ON stock_obrador(serie);
`;

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:lJ3Z7dDp8PoDTWnZ@db.dffhvutwwqeumyikinkc.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase!');
    
    await client.query(SQL);
    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();

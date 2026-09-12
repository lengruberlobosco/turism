-- Fase 4 (continuação): módulo veículo e geolocalização de fotos (EXIF).
alter table expenses add column if not exists liters numeric(8,2);
alter table expenses add column if not exists odometer_km numeric(10,1);
alter table assets add column if not exists lat double precision;
alter table assets add column if not exists lng double precision;

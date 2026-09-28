-- -------------------------------------------------------
-- Project Name: TastyApp Database
-- Purpose: Main database schema creation script
-- -------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name NOT IN (
    'spatial_ref_sys',
    'geography_columns',
    'geometry_columns',
    'pg_stat_statements_info',
    'pg_stat_statements',
    'raster_columns',
    'raster_overviews'
  );
DROP TABLE IF EXISTS PHONES;
DROP TABLE IF EXISTS PROFILE;
DROP TABLE IF EXISTS LOGINS;


-- ---------- TABLE LOGINS -----------
CREATE TABLE IF NOT EXISTS LOGINS (
  log_id     int AUTO_INCREMENT,
  Usuario    varchar(255) NOT NULL,
  Email varchar(255) NOT NULL,
  Password   char(100) NOT NULL,
  Rol        varchar(50) NOT NULL DEFAULT 'client',
  CONSTRAINT pk_LOGINS PRIMARY KEY (log_id)
);

-- ---------- TABLE PROFILE -----------
CREATE TABLE IF NOT EXISTS PROFILE (
  p_id        int AUTO_INCREMENT,
  log_id      int NOT NULL,
  Nombre      varchar(255) NOT NULL,
  ApellidoP   varchar(255) NOT NULL,
  ApellidoM   varchar(255),
  img_path    varchar(255) default 'default.png',
  CONSTRAINT pk_PROFILE PRIMARY KEY (p_id),
  CONSTRAINT fk_PROFILE_log_id FOREIGN KEY (log_id) REFERENCES LOGINS(log_id)
);

-- ---------- TABLE PHONES -----------
CREATE TABLE IF NOT EXISTS PHONES (
  fn_id      int AUTO_INCREMENT,
  p_id       int NOT NULL,
  Numero     varchar(10) NOT NULL,
  Detalles   varchar(255),
  CONSTRAINT pk_PHONES PRIMARY KEY (fn_id),
  CONSTRAINT fk_PHONES_p_id FOREIGN KEY (p_id) REFERENCES PROFILE(p_id)
);

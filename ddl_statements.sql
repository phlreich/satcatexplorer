SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.owner_lookup (
    owner VARCHAR(255) PRIMARY KEY,
    country_or_org VARCHAR(255)
);

ALTER TABLE public.owner_lookup OWNER TO satcatmaster;

CREATE TABLE public.no_gp (
    norad_cat_id INT PRIMARY KEY,
    gp_data_available BOOLEAN
);

ALTER TABLE public.no_gp OWNER TO satcatmaster;

CREATE TABLE public.orbitdata (
    object_name VARCHAR(255),
    object_id VARCHAR(50),
    epoch TIMESTAMP,
    mean_motion REAL,
    eccentricity REAL,
    inclination REAL,
    ra_of_asc_node REAL,
    arg_of_pericenter REAL,
    mean_anomaly REAL,
    ephemeris_type INT,
    classification_type CHAR(1),
    norad_cat_id INT PRIMARY KEY,
    element_set_no INT,
    rev_at_epoch REAL,
    bstar REAL,
    mean_motion_dot REAL,
    mean_motion_ddot REAL
);

ALTER TABLE public.orbitdata OWNER TO satcatmaster;

CREATE TABLE public.satcatdata (
    object_name VARCHAR(255),
    object_id VARCHAR(255),
    norad_cat_id INT PRIMARY KEY,
    object_type VARCHAR(10),
    ops_status_code VARCHAR(10),
    owner VARCHAR(255),
    launch_date DATE,
    launch_site VARCHAR(255),
    decay_date DATE,
    period REAL,
    inclination REAL,
    apogee REAL,
    perigee REAL,
    rcs REAL,
    data_status_code VARCHAR(10),
    orbit_center VARCHAR(50),
    docked_norad_cat_id INT,
    orbit_type VARCHAR(10)
);

ALTER TABLE public.satcatdata OWNER TO satcatmaster;

CREATE VIEW public.satcat_orbitdata AS
 SELECT satcatdata.object_name,
    satcatdata.norad_cat_id,
    satcatdata.object_type,
    owner_lookup.country_or_org AS owner,
    satcatdata.launch_date,
    satcatdata.launch_site,
    satcatdata.period,
    satcatdata.apogee,
    satcatdata.perigee,
    satcatdata.rcs,
    orbitdata.epoch,
    orbitdata.mean_motion,
    orbitdata.eccentricity,
    orbitdata.inclination,
    orbitdata.ra_of_asc_node,
    orbitdata.arg_of_pericenter,
    orbitdata.mean_anomaly,
    orbitdata.rev_at_epoch,
    orbitdata.bstar
   FROM ((public.satcatdata
     JOIN public.orbitdata ON ((satcatdata.norad_cat_id = orbitdata.norad_cat_id)))
     LEFT JOIN public.owner_lookup ON (((satcatdata.owner)::TEXT = (owner_lookup.owner)::TEXT)));

ALTER TABLE public.satcat_orbitdata OWNER TO satcatmaster;

CREATE VIEW public.satcatdata_viable AS
 SELECT satcatdata.object_name,
    satcatdata.object_id,
    satcatdata.norad_cat_id,
    satcatdata.object_type,
    satcatdata.ops_status_code,
    satcatdata.owner,
    satcatdata.launch_date,
    satcatdata.launch_site,
    satcatdata.decay_date,
    satcatdata.period,
    satcatdata.inclination,
    satcatdata.apogee,
    satcatdata.perigee,
    satcatdata.rcs,
    satcatdata.data_status_code,
    satcatdata.orbit_center,
    satcatdata.docked_norad_cat_id,
    satcatdata.orbit_type
   FROM public.satcatdata
  WHERE (((satcatdata.orbit_type)::TEXT = 'ORB'::TEXT) AND (satcatdata.data_status_code IS NULL) AND ((satcatdata.orbit_center)::TEXT = 'EA'::TEXT) AND (NOT (satcatdata.norad_cat_id IN ( SELECT no_gp.norad_cat_id
           FROM public.no_gp))));

ALTER TABLE public.satcatdata_viable OWNER TO satcatmaster;

CREATE TABLE public.settings (
    gpt_api_active BOOLEAN
);

ALTER TABLE public.settings OWNER TO satcatmaster;

GRANT ALL ON SCHEMA public TO satcatmaster;

GRANT SELECT ON TABLE public.no_gp TO satcatuser;

GRANT SELECT ON TABLE public.orbitdata TO satcatuser;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO satcatmaster;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO satcatuser;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO satcatmaster;

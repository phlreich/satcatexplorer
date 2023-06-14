--
-- PostgreSQL database dump
--

-- Dumped from database version 13.11 (Raspbian 13.11-0+deb11u1)
-- Dumped by pg_dump version 13.11 (Raspbian 13.11-0+deb11u1)

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

--
-- Name: no_gp; Type: TABLE; Schema: public; Owner: satcatmaster
--

CREATE TABLE public.no_gp (
    norad_cat_id integer NOT NULL,
    gp_data_available boolean
);


ALTER TABLE public.no_gp OWNER TO satcatmaster;

--
-- Name: orbitdata; Type: TABLE; Schema: public; Owner: satcatmaster
--

CREATE TABLE public.orbitdata (
    object_name character varying(255),
    object_id character varying(50),
    epoch timestamp without time zone,
    mean_motion real,
    eccentricity real,
    inclination real,
    ra_of_asc_node real,
    arg_of_pericenter real,
    mean_anomaly real,
    ephemeris_type integer,
    classification_type character(1),
    norad_cat_id integer NOT NULL,
    element_set_no integer,
    rev_at_epoch real,
    bstar real,
    mean_motion_dot real,
    mean_motion_ddot real
);


ALTER TABLE public.orbitdata OWNER TO satcatmaster;

--
-- Name: orbitdata_last_updated; Type: TABLE; Schema: public; Owner: satcatmaster
--

CREATE TABLE public.orbitdata_last_updated (
    norad_cat_id integer NOT NULL,
    last_update timestamp without time zone DEFAULT to_timestamp((0)::double precision)
);


ALTER TABLE public.orbitdata_last_updated OWNER TO satcatmaster;

--
-- Name: owner_lookup; Type: TABLE; Schema: public; Owner: satcatmaster
--

CREATE TABLE public.owner_lookup (
    owner character varying(255) NOT NULL,
    country_or_org character varying(255)
);


ALTER TABLE public.owner_lookup OWNER TO satcatmaster;

--
-- Name: satcatdata; Type: TABLE; Schema: public; Owner: satcatmaster
--

CREATE TABLE public.satcatdata (
    object_name character varying(255),
    object_id character varying(255),
    norad_cat_id integer NOT NULL,
    object_type character varying(10),
    ops_status_code character varying(10),
    owner character varying(255),
    launch_date date,
    launch_site character varying(255),
    decay_date date,
    period real,
    inclination real,
    apogee real,
    perigee real,
    rcs real,
    data_status_code character varying(10),
    orbit_center character varying(50),
    docked_norad_cat_id integer,
    orbit_type character varying(10)
);


ALTER TABLE public.satcatdata OWNER TO satcatmaster;

--
-- Name: satcat_orbitdata; Type: VIEW; Schema: public; Owner: satcatmaster
--

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
     LEFT JOIN public.owner_lookup ON (((satcatdata.owner)::text = (owner_lookup.owner)::text)));


ALTER TABLE public.satcat_orbitdata OWNER TO satcatmaster;

--
-- Name: satcatdata_viable; Type: VIEW; Schema: public; Owner: satcatmaster
--

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
  WHERE (((satcatdata.orbit_type)::text = 'ORB'::text) AND (satcatdata.data_status_code IS NULL) AND ((satcatdata.orbit_center)::text = 'EA'::text) AND (NOT (satcatdata.norad_cat_id IN ( SELECT no_gp.norad_cat_id
           FROM public.no_gp))));


ALTER TABLE public.satcatdata_viable OWNER TO satcatmaster;

--
-- Name: settings; Type: TABLE; Schema: public; Owner: satcatmaster
--

CREATE TABLE public.settings (
    gpt_api_active boolean
);


ALTER TABLE public.settings OWNER TO satcatmaster;

--
-- Name: no_gp no_gp_pkey; Type: CONSTRAINT; Schema: public; Owner: satcatmaster
--

ALTER TABLE ONLY public.no_gp
    ADD CONSTRAINT no_gp_pkey PRIMARY KEY (norad_cat_id);


--
-- Name: orbitdata_last_updated orbitdata_last_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: satcatmaster
--

ALTER TABLE ONLY public.orbitdata_last_updated
    ADD CONSTRAINT orbitdata_last_updated_pkey PRIMARY KEY (norad_cat_id);


--
-- Name: orbitdata orbitdata_pkey; Type: CONSTRAINT; Schema: public; Owner: satcatmaster
--

ALTER TABLE ONLY public.orbitdata
    ADD CONSTRAINT orbitdata_pkey PRIMARY KEY (norad_cat_id);


--
-- Name: owner_lookup owner_lookup_pkey; Type: CONSTRAINT; Schema: public; Owner: satcatmaster
--

ALTER TABLE ONLY public.owner_lookup
    ADD CONSTRAINT owner_lookup_pkey PRIMARY KEY (owner);


--
-- Name: satcatdata satcatdata_pkey; Type: CONSTRAINT; Schema: public; Owner: satcatmaster
--

ALTER TABLE ONLY public.satcatdata
    ADD CONSTRAINT satcatdata_pkey PRIMARY KEY (norad_cat_id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

GRANT ALL ON SCHEMA public TO satcatmaster;


--
-- Name: TABLE satcat_orbitdata; Type: ACL; Schema: public; Owner: satcatmaster
--

GRANT SELECT ON TABLE public.satcat_orbitdata TO satcatuser;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO satcatmaster;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO satcatmaster;


--
-- PostgreSQL database dump complete
--


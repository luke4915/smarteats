--
-- PostgreSQL database dump
--

\restrict q6zdAwXbbrP30lntmIehXkdmAj8Cfvyno7NSpEW4aSQ5KRNKVnBopdjaV2b81av

-- Dumped from database version 17.10 (Homebrew)
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
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
-- Name: _migrations; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public._migrations (
    id integer NOT NULL,
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public._migrations OWNER TO colettas;

--
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public._migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._migrations_id_seq OWNER TO colettas;

--
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
-- Name: app_feedback; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.app_feedback (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    user_id integer,
    username text NOT NULL,
    module text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_feedback_message_check CHECK (((length(btrim(message)) >= 3) AND (length(btrim(message)) <= 2000))),
    CONSTRAINT app_feedback_module_check CHECK ((module = ANY (ARRAY['general'::text, 'pos'::text, 'floor'::text, 'reservations'::text, 'takeaway'::text, 'kitchen'::text, 'catalog'::text, 'stats'::text, 'settings'::text]))),
    CONSTRAINT app_feedback_status_check CHECK ((status = ANY (ARRAY['new'::text, 'read'::text])))
);

ALTER TABLE ONLY public.app_feedback FORCE ROW LEVEL SECURITY;


ALTER TABLE public.app_feedback OWNER TO colettas;

--
-- Name: app_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.app_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_feedback_id_seq OWNER TO colettas;

--
-- Name: app_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.app_feedback_id_seq OWNED BY public.app_feedback.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL
);

ALTER TABLE ONLY public.audit_logs FORCE ROW LEVEL SECURITY;


ALTER TABLE public.audit_logs OWNER TO colettas;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO colettas;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: booking_closures; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.booking_closures (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    date_from date NOT NULL,
    date_to date NOT NULL,
    shift_id integer,
    reason text DEFAULT ''::text NOT NULL,
    CONSTRAINT booking_closures_range CHECK ((date_to >= date_from))
);

ALTER TABLE ONLY public.booking_closures FORCE ROW LEVEL SECURITY;


ALTER TABLE public.booking_closures OWNER TO colettas;

--
-- Name: booking_closures_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.booking_closures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_closures_id_seq OWNER TO colettas;

--
-- Name: booking_closures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.booking_closures_id_seq OWNED BY public.booking_closures.id;


--
-- Name: booking_shifts; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.booking_shifts (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    duration_minutes integer DEFAULT 90 NOT NULL,
    weekdays smallint[] DEFAULT '{0,1,2,3,4,5,6}'::smallint[] NOT NULL,
    capacity integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT booking_shifts_capacity_check CHECK (((capacity >= 1) AND (capacity <= 999))),
    CONSTRAINT booking_shifts_duration_minutes_check CHECK (((duration_minutes >= 15) AND (duration_minutes <= 480))),
    CONSTRAINT booking_shifts_name_check CHECK ((length(btrim(name)) > 0))
);

ALTER TABLE ONLY public.booking_shifts FORCE ROW LEVEL SECURITY;


ALTER TABLE public.booking_shifts OWNER TO colettas;

--
-- Name: booking_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.booking_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_shifts_id_seq OWNER TO colettas;

--
-- Name: booking_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.booking_shifts_id_seq OWNED BY public.booking_shifts.id;


--
-- Name: checks; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.checks (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    session_id integer NOT NULL,
    table_id integer,
    number integer NOT NULL,
    covers integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    opened_by integer,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    bill_requested_at timestamp with time zone,
    closed_at timestamp with time zone,
    merged_into integer,
    cover_charge numeric(8,2) DEFAULT 0 NOT NULL,
    CONSTRAINT checks_cover_charge_check CHECK ((cover_charge >= (0)::numeric)),
    CONSTRAINT checks_covers_check CHECK (((covers >= 0) AND (covers <= 99))),
    CONSTRAINT checks_number_check CHECK ((number > 0)),
    CONSTRAINT checks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'paid'::text, 'void'::text])))
);

ALTER TABLE ONLY public.checks FORCE ROW LEVEL SECURITY;


ALTER TABLE public.checks OWNER TO colettas;

--
-- Name: checks_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.checks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checks_id_seq OWNER TO colettas;

--
-- Name: checks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.checks_id_seq OWNED BY public.checks.id;


--
-- Name: copy_types; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.copy_types (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    label character varying(100) NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL
);

ALTER TABLE ONLY public.copy_types FORCE ROW LEVEL SECURITY;


ALTER TABLE public.copy_types OWNER TO colettas;

--
-- Name: copy_types_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.copy_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.copy_types_id_seq OWNER TO colettas;

--
-- Name: copy_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.copy_types_id_seq OWNED BY public.copy_types.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    with_previous boolean DEFAULT false NOT NULL,
    CONSTRAINT courses_name_check CHECK ((length(btrim(name)) > 0))
);

ALTER TABLE ONLY public.courses FORCE ROW LEVEL SECURITY;


ALTER TABLE public.courses OWNER TO colettas;

--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.courses_id_seq OWNER TO colettas;

--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.devices (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    letter character(1) NOT NULL,
    name character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT devices_letter_check CHECK ((letter ~ '^[A-Z]$'::text))
);

ALTER TABLE ONLY public.devices FORCE ROW LEVEL SECURITY;


ALTER TABLE public.devices OWNER TO colettas;

--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.devices_id_seq OWNER TO colettas;

--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: dining_tables; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.dining_tables (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    room_id integer NOT NULL,
    name text NOT NULL,
    seats integer DEFAULT 2 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    x integer,
    y integer,
    w integer,
    h integer,
    shape text DEFAULT 'rect'::text NOT NULL,
    seats_min integer DEFAULT 1 NOT NULL,
    CONSTRAINT dining_tables_h_check CHECK (((h >= 1) AND (h <= 30))),
    CONSTRAINT dining_tables_name_check CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT dining_tables_placement_complete CHECK ((((x IS NULL) AND (y IS NULL) AND (w IS NULL) AND (h IS NULL)) OR ((x IS NOT NULL) AND (y IS NOT NULL) AND (w IS NOT NULL) AND (h IS NOT NULL)))),
    CONSTRAINT dining_tables_seats_check CHECK (((seats >= 1) AND (seats <= 99))),
    CONSTRAINT dining_tables_seats_min_check CHECK (((seats_min >= 1) AND (seats_min <= seats))),
    CONSTRAINT dining_tables_shape_check CHECK ((shape = ANY (ARRAY['rect'::text, 'round'::text]))),
    CONSTRAINT dining_tables_w_check CHECK (((w >= 1) AND (w <= 30))),
    CONSTRAINT dining_tables_x_check CHECK ((x >= 0)),
    CONSTRAINT dining_tables_y_check CHECK ((y >= 0))
);

ALTER TABLE ONLY public.dining_tables FORCE ROW LEVEL SECURITY;


ALTER TABLE public.dining_tables OWNER TO colettas;

--
-- Name: dining_tables_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.dining_tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dining_tables_id_seq OWNER TO colettas;

--
-- Name: dining_tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.dining_tables_id_seq OWNED BY public.dining_tables.id;


--
-- Name: modifier_groups; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.modifier_groups (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    name text NOT NULL,
    min_select integer DEFAULT 0 NOT NULL,
    max_select integer,
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT modifier_groups_max_select_check CHECK (((max_select >= 1) AND (max_select <= 20))),
    CONSTRAINT modifier_groups_min_max CHECK (((max_select IS NULL) OR (max_select >= min_select))),
    CONSTRAINT modifier_groups_min_select_check CHECK (((min_select >= 0) AND (min_select <= 20))),
    CONSTRAINT modifier_groups_name_check CHECK ((length(btrim(name)) > 0))
);

ALTER TABLE ONLY public.modifier_groups FORCE ROW LEVEL SECURITY;


ALTER TABLE public.modifier_groups OWNER TO colettas;

--
-- Name: modifier_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.modifier_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.modifier_groups_id_seq OWNER TO colettas;

--
-- Name: modifier_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.modifier_groups_id_seq OWNED BY public.modifier_groups.id;


--
-- Name: modifiers; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.modifiers (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    group_id integer NOT NULL,
    name text NOT NULL,
    price_delta numeric(12,2) DEFAULT 0 NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT modifiers_name_check CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT modifiers_price_delta_check CHECK (((price_delta >= ('-1000'::integer)::numeric) AND (price_delta <= (1000)::numeric)))
);

ALTER TABLE ONLY public.modifiers FORCE ROW LEVEL SECURITY;


ALTER TABLE public.modifiers OWNER TO colettas;

--
-- Name: modifiers_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.modifiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.modifiers_id_seq OWNER TO colettas;

--
-- Name: modifiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.modifiers_id_seq OWNED BY public.modifiers.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    order_id integer NOT NULL,
    "position" integer NOT NULL,
    product_id bigint,
    name text NOT NULL,
    category text,
    print_destination text,
    quantity integer NOT NULL,
    unit_price numeric(16,8) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    original_price numeric(12,4),
    line_type text DEFAULT 'sale'::text NOT NULL,
    discount_mode text,
    discount_value numeric(12,4),
    note text DEFAULT ''::text NOT NULL,
    prep_status text DEFAULT 'new'::text NOT NULL,
    ready_at timestamp with time zone,
    served_at timestamp with time zone,
    modifiers jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT order_items_line_type_check CHECK ((line_type = ANY (ARRAY['sale'::text, 'gift'::text, 'discount'::text]))),
    CONSTRAINT order_items_position_check CHECK (("position" >= 0)),
    CONSTRAINT order_items_prep_status_check CHECK ((prep_status = ANY (ARRAY['new'::text, 'preparing'::text, 'ready'::text, 'served'::text]))),
    CONSTRAINT order_items_print_destination_check CHECK ((print_destination = ANY (ARRAY['bar'::text, 'kitchen'::text, 'both'::text]))),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);

ALTER TABLE ONLY public.order_items FORCE ROW LEVEL SECURITY;


ALTER TABLE public.order_items OWNER TO colettas;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO colettas;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    total numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by integer,
    completed_at timestamp with time zone,
    order_type character varying(10) DEFAULT 'sale'::character varying NOT NULL,
    is_takeaway boolean DEFAULT false NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    display_code character varying(10),
    session_id integer,
    client_order_id uuid,
    device_id integer,
    device_seq integer,
    check_id integer,
    course_seq integer,
    course_name text,
    fired_at timestamp with time zone,
    CONSTRAINT orders_course_seq_check CHECK ((course_seq >= 1)),
    CONSTRAINT orders_device_pair_check CHECK (((device_id IS NULL) = (device_seq IS NULL))),
    CONSTRAINT orders_device_seq_check CHECK ((device_seq > 0)),
    CONSTRAINT orders_order_type_check CHECK (((order_type)::text = ANY ((ARRAY['sale'::character varying, 'gift'::character varying, 'discount'::character varying, 'cover'::character varying])::text[]))),
    CONSTRAINT orders_scheduled_on_check CHECK (((status <> 'scheduled'::text) OR ((check_id IS NOT NULL) AND (course_seq IS NOT NULL)))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'pending'::text, 'preparing'::text, 'completed'::text, 'canceled'::text])))
);

ALTER TABLE ONLY public.orders FORCE ROW LEVEL SECURITY;


ALTER TABLE public.orders OWNER TO colettas;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO colettas;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: payment_items; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.payment_items (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    payment_id integer NOT NULL,
    order_item_id integer NOT NULL,
    quantity integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    CONSTRAINT payment_items_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payment_items_quantity_check CHECK ((quantity > 0))
);

ALTER TABLE ONLY public.payment_items FORCE ROW LEVEL SECURITY;


ALTER TABLE public.payment_items OWNER TO colettas;

--
-- Name: payment_items_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.payment_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_items_id_seq OWNER TO colettas;

--
-- Name: payment_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.payment_items_id_seq OWNED BY public.payment_items.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    check_id integer NOT NULL,
    method text NOT NULL,
    amount numeric(12,2) NOT NULL,
    paid_by integer,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_method_check CHECK ((method = ANY (ARRAY['cash'::text, 'card'::text, 'other'::text])))
);

ALTER TABLE ONLY public.payments FORCE ROW LEVEL SECURITY;


ALTER TABLE public.payments OWNER TO colettas;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO colettas;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: print_settings; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.print_settings (
    id integer NOT NULL,
    copy_type_id integer NOT NULL,
    printer_type character varying(10) DEFAULT 'network'::character varying NOT NULL,
    printer_address character varying(255),
    enabled boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    CONSTRAINT print_settings_printer_type_check CHECK (((printer_type)::text = ANY (ARRAY[('network'::character varying)::text, ('usb'::character varying)::text])))
);

ALTER TABLE ONLY public.print_settings FORCE ROW LEVEL SECURITY;


ALTER TABLE public.print_settings OWNER TO colettas;

--
-- Name: print_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.print_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.print_settings_id_seq OWNER TO colettas;

--
-- Name: print_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.print_settings_id_seq OWNED BY public.print_settings.id;


--
-- Name: product_modifier_groups; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.product_modifier_groups (
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    product_id integer NOT NULL,
    group_id integer NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.product_modifier_groups FORCE ROW LEVEL SECURITY;


ALTER TABLE public.product_modifier_groups OWNER TO colettas;

--
-- Name: products; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    category text,
    color text DEFAULT '#3b82f6'::text,
    visible boolean DEFAULT true,
    print_destination character varying(10) DEFAULT 'both'::character varying NOT NULL,
    stock integer,
    stock_enabled boolean DEFAULT false NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    course_id integer,
    takeaway_load integer DEFAULT 1 NOT NULL,
    CONSTRAINT products_print_destination_check CHECK (((print_destination)::text = ANY ((ARRAY['bar'::character varying, 'kitchen'::character varying, 'both'::character varying])::text[]))),
    CONSTRAINT products_takeaway_load_check CHECK (((takeaway_load >= 0) AND (takeaway_load <= 20)))
);

ALTER TABLE ONLY public.products FORCE ROW LEVEL SECURITY;


ALTER TABLE public.products OWNER TO colettas;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO colettas;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: reservation_tables; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.reservation_tables (
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    reservation_id integer NOT NULL,
    table_id integer NOT NULL
);

ALTER TABLE ONLY public.reservation_tables FORCE ROW LEVEL SECURITY;


ALTER TABLE public.reservation_tables OWNER TO colettas;

--
-- Name: reservations; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.reservations (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    date date NOT NULL,
    shift_id integer NOT NULL,
    party_size integer NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL,
    customer_name text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    source text DEFAULT 'staff'::text NOT NULL,
    external_id text,
    public_token text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by integer,
    decided_at timestamp with time zone,
    decline_reason text DEFAULT ''::text NOT NULL,
    check_id integer,
    created_by integer,
    consent_at timestamp with time zone,
    personal_data_purged_at timestamp with time zone,
    cancel_requested_at timestamp with time zone,
    marketing_consent_at timestamp with time zone,
    CONSTRAINT reservations_customer_name_check CHECK ((length(btrim(customer_name)) > 0)),
    CONSTRAINT reservations_party_size_check CHECK (((party_size >= 1) AND (party_size <= 99))),
    CONSTRAINT reservations_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'confirmed'::text, 'declined'::text, 'cancelled'::text, 'seated'::text, 'completed'::text, 'no_show'::text, 'expired'::text])))
);

ALTER TABLE ONLY public.reservations FORCE ROW LEVEL SECURITY;


ALTER TABLE public.reservations OWNER TO colettas;

--
-- Name: reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reservations_id_seq OWNER TO colettas;

--
-- Name: reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.reservations_id_seq OWNED BY public.reservations.id;


--
-- Name: room_elements; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.room_elements (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    room_id integer NOT NULL,
    kind text DEFAULT 'wall'::text NOT NULL,
    x integer NOT NULL,
    y integer NOT NULL,
    w integer NOT NULL,
    h integer NOT NULL,
    CONSTRAINT room_elements_h_check CHECK (((h >= 1) AND (h <= 60))),
    CONSTRAINT room_elements_kind_check CHECK ((kind = ANY (ARRAY['wall'::text, 'divider'::text]))),
    CONSTRAINT room_elements_w_check CHECK (((w >= 1) AND (w <= 60))),
    CONSTRAINT room_elements_x_check CHECK ((x >= 0)),
    CONSTRAINT room_elements_y_check CHECK ((y >= 0))
);

ALTER TABLE ONLY public.room_elements FORCE ROW LEVEL SECURITY;


ALTER TABLE public.room_elements OWNER TO colettas;

--
-- Name: room_elements_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.room_elements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.room_elements_id_seq OWNER TO colettas;

--
-- Name: room_elements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.room_elements_id_seq OWNED BY public.room_elements.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.rooms (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    grid_w integer DEFAULT 24 NOT NULL,
    grid_h integer DEFAULT 16 NOT NULL,
    CONSTRAINT rooms_grid_h_check CHECK (((grid_h >= 4) AND (grid_h <= 60))),
    CONSTRAINT rooms_grid_w_check CHECK (((grid_w >= 4) AND (grid_w <= 60))),
    CONSTRAINT rooms_name_check CHECK ((length(btrim(name)) > 0))
);

ALTER TABLE ONLY public.rooms FORCE ROW LEVEL SECURITY;


ALTER TABLE public.rooms OWNER TO colettas;

--
-- Name: rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rooms_id_seq OWNER TO colettas;

--
-- Name: rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.rooms_id_seq OWNED BY public.rooms.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    name character varying(100),
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    declared_cash numeric(10,2),
    expected_cash numeric(10,2),
    order_counter integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.sessions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.sessions OWNER TO colettas;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO colettas;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.settings (
    key character varying(100) NOT NULL,
    value text,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL
);

ALTER TABLE ONLY public.settings FORCE ROW LEVEL SECURITY;


ALTER TABLE public.settings OWNER TO colettas;

--
-- Name: takeaway_hours; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.takeaway_hours (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    weekday smallint NOT NULL,
    open_time time without time zone NOT NULL,
    close_time time without time zone NOT NULL,
    CONSTRAINT takeaway_hours_check CHECK ((close_time > open_time)),
    CONSTRAINT takeaway_hours_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);

ALTER TABLE ONLY public.takeaway_hours FORCE ROW LEVEL SECURITY;


ALTER TABLE public.takeaway_hours OWNER TO colettas;

--
-- Name: takeaway_hours_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.takeaway_hours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.takeaway_hours_id_seq OWNER TO colettas;

--
-- Name: takeaway_hours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.takeaway_hours_id_seq OWNED BY public.takeaway_hours.id;


--
-- Name: takeaway_orders; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.takeaway_orders (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    source text NOT NULL,
    pickup_at timestamp with time zone NOT NULL,
    load integer DEFAULT 0 NOT NULL,
    customer_name text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    items jsonb NOT NULL,
    total numeric(10,2) NOT NULL,
    order_id integer,
    public_token text NOT NULL,
    payment_mode text DEFAULT 'on_pickup'::text NOT NULL,
    paid_method text,
    reject_reason text DEFAULT ''::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by integer,
    decided_at timestamp with time zone,
    picked_up_at timestamp with time zone,
    consent_at timestamp with time zone,
    created_by integer,
    personal_data_purged_at timestamp with time zone,
    CONSTRAINT takeaway_orders_customer_name_check CHECK ((length(btrim(customer_name)) > 0)),
    CONSTRAINT takeaway_orders_load_check CHECK ((load >= 0)),
    CONSTRAINT takeaway_orders_paid_method_check CHECK ((paid_method = ANY (ARRAY['cash'::text, 'card'::text, 'other'::text]))),
    CONSTRAINT takeaway_orders_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['on_pickup'::text, 'online'::text]))),
    CONSTRAINT takeaway_orders_source_check CHECK ((source = ANY (ARRAY['portal'::text, 'counter'::text, 'phone'::text]))),
    CONSTRAINT takeaway_orders_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'accepted'::text, 'picked_up'::text, 'rejected'::text, 'cancelled'::text, 'expired'::text])))
);

ALTER TABLE ONLY public.takeaway_orders FORCE ROW LEVEL SECURITY;


ALTER TABLE public.takeaway_orders OWNER TO colettas;

--
-- Name: takeaway_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.takeaway_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.takeaway_orders_id_seq OWNER TO colettas;

--
-- Name: takeaway_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.takeaway_orders_id_seq OWNED BY public.takeaway_orders.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    plan text DEFAULT 'trial'::text NOT NULL,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    business_type text DEFAULT 'street_food'::text NOT NULL,
    modules text[] DEFAULT ARRAY['kds'::text, 'stats'::text, 'qr_menu'::text] NOT NULL,
    CONSTRAINT tenants_business_type_check CHECK ((business_type = ANY (ARRAY['street_food'::text, 'restaurant'::text, 'takeaway_shop'::text])))
);


ALTER TABLE public.tenants OWNER TO colettas;

--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenants_id_seq OWNER TO colettas;

--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash text,
    role character varying(20) NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'cashier'::character varying, 'waiter'::character varying, 'kitchen'::character varying])::text[])))
);

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


ALTER TABLE public.users OWNER TO colettas;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO colettas;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: whatsapp_message_tenants; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.whatsapp_message_tenants (
    wa_message_id text NOT NULL,
    tenant_id integer NOT NULL,
    to_phone text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.whatsapp_message_tenants OWNER TO colettas;

--
-- Name: whatsapp_messages; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.whatsapp_messages (
    id integer NOT NULL,
    tenant_id integer DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer NOT NULL,
    ref_type text NOT NULL,
    ref_id integer NOT NULL,
    event text NOT NULL,
    to_phone text DEFAULT ''::text NOT NULL,
    template text NOT NULL,
    category text DEFAULT 'utility'::text NOT NULL,
    params jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    error text DEFAULT ''::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    wa_message_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT whatsapp_messages_category_check CHECK ((category = ANY (ARRAY['utility'::text, 'marketing'::text]))),
    CONSTRAINT whatsapp_messages_ref_type_check CHECK ((ref_type = ANY (ARRAY['reservation'::text, 'takeaway'::text]))),
    CONSTRAINT whatsapp_messages_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'skipped'::text])))
);

ALTER TABLE ONLY public.whatsapp_messages FORCE ROW LEVEL SECURITY;


ALTER TABLE public.whatsapp_messages OWNER TO colettas;

--
-- Name: whatsapp_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: colettas
--

CREATE SEQUENCE public.whatsapp_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.whatsapp_messages_id_seq OWNER TO colettas;

--
-- Name: whatsapp_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: colettas
--

ALTER SEQUENCE public.whatsapp_messages_id_seq OWNED BY public.whatsapp_messages.id;


--
-- Name: whatsapp_optouts; Type: TABLE; Schema: public; Owner: colettas
--

CREATE TABLE public.whatsapp_optouts (
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.whatsapp_optouts OWNER TO colettas;

--
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- Name: app_feedback id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.app_feedback ALTER COLUMN id SET DEFAULT nextval('public.app_feedback_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: booking_closures id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.booking_closures ALTER COLUMN id SET DEFAULT nextval('public.booking_closures_id_seq'::regclass);


--
-- Name: booking_shifts id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.booking_shifts ALTER COLUMN id SET DEFAULT nextval('public.booking_shifts_id_seq'::regclass);


--
-- Name: checks id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.checks ALTER COLUMN id SET DEFAULT nextval('public.checks_id_seq'::regclass);


--
-- Name: copy_types id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.copy_types ALTER COLUMN id SET DEFAULT nextval('public.copy_types_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: dining_tables id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.dining_tables ALTER COLUMN id SET DEFAULT nextval('public.dining_tables_id_seq'::regclass);


--
-- Name: modifier_groups id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.modifier_groups ALTER COLUMN id SET DEFAULT nextval('public.modifier_groups_id_seq'::regclass);


--
-- Name: modifiers id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.modifiers ALTER COLUMN id SET DEFAULT nextval('public.modifiers_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: payment_items id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payment_items ALTER COLUMN id SET DEFAULT nextval('public.payment_items_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: print_settings id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.print_settings ALTER COLUMN id SET DEFAULT nextval('public.print_settings_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: reservations id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservations ALTER COLUMN id SET DEFAULT nextval('public.reservations_id_seq'::regclass);


--
-- Name: room_elements id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.room_elements ALTER COLUMN id SET DEFAULT nextval('public.room_elements_id_seq'::regclass);


--
-- Name: rooms id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.rooms ALTER COLUMN id SET DEFAULT nextval('public.rooms_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: takeaway_hours id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_hours ALTER COLUMN id SET DEFAULT nextval('public.takeaway_hours_id_seq'::regclass);


--
-- Name: takeaway_orders id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_orders ALTER COLUMN id SET DEFAULT nextval('public.takeaway_orders_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: whatsapp_messages id; Type: DEFAULT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.whatsapp_messages ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_messages_id_seq'::regclass);


--
-- Name: _migrations _migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_name_key UNIQUE (name);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- Name: app_feedback app_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: booking_closures booking_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.booking_closures
    ADD CONSTRAINT booking_closures_pkey PRIMARY KEY (id);


--
-- Name: booking_shifts booking_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.booking_shifts
    ADD CONSTRAINT booking_shifts_pkey PRIMARY KEY (id);


--
-- Name: checks checks_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.checks
    ADD CONSTRAINT checks_pkey PRIMARY KEY (id);


--
-- Name: copy_types copy_types_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.copy_types
    ADD CONSTRAINT copy_types_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: devices devices_tenant_id_letter_key; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_tenant_id_letter_key UNIQUE (tenant_id, letter);


--
-- Name: dining_tables dining_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_pkey PRIMARY KEY (id);


--
-- Name: modifier_groups modifier_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.modifier_groups
    ADD CONSTRAINT modifier_groups_pkey PRIMARY KEY (id);


--
-- Name: modifiers modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_items payment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: print_settings print_settings_copy_type_id_key; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.print_settings
    ADD CONSTRAINT print_settings_copy_type_id_key UNIQUE (copy_type_id);


--
-- Name: print_settings print_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.print_settings
    ADD CONSTRAINT print_settings_pkey PRIMARY KEY (id);


--
-- Name: product_modifier_groups product_modifier_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.product_modifier_groups
    ADD CONSTRAINT product_modifier_groups_pkey PRIMARY KEY (product_id, group_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: reservation_tables reservation_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservation_tables
    ADD CONSTRAINT reservation_tables_pkey PRIMARY KEY (reservation_id, table_id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: room_elements room_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.room_elements
    ADD CONSTRAINT room_elements_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (tenant_id, key);


--
-- Name: takeaway_hours takeaway_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_hours
    ADD CONSTRAINT takeaway_hours_pkey PRIMARY KEY (id);


--
-- Name: takeaway_orders takeaway_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_orders
    ADD CONSTRAINT takeaway_orders_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_message_tenants whatsapp_message_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.whatsapp_message_tenants
    ADD CONSTRAINT whatsapp_message_tenants_pkey PRIMARY KEY (wa_message_id);


--
-- Name: whatsapp_messages whatsapp_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_optouts whatsapp_optouts_pkey; Type: CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.whatsapp_optouts
    ADD CONSTRAINT whatsapp_optouts_pkey PRIMARY KEY (phone);


--
-- Name: idx_app_feedback_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_app_feedback_tenant ON public.app_feedback USING btree (tenant_id, created_at DESC);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_audit_logs_tenant ON public.audit_logs USING btree (tenant_id);


--
-- Name: idx_booking_closures_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_booking_closures_tenant ON public.booking_closures USING btree (tenant_id, date_from);


--
-- Name: idx_booking_shifts_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_booking_shifts_tenant ON public.booking_shifts USING btree (tenant_id);


--
-- Name: idx_checks_tenant_status; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_checks_tenant_status ON public.checks USING btree (tenant_id, status);


--
-- Name: idx_copy_types_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_copy_types_tenant ON public.copy_types USING btree (tenant_id);


--
-- Name: idx_courses_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_courses_tenant ON public.courses USING btree (tenant_id);


--
-- Name: idx_devices_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_devices_tenant ON public.devices USING btree (tenant_id);


--
-- Name: idx_dining_tables_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_dining_tables_tenant ON public.dining_tables USING btree (tenant_id);


--
-- Name: idx_modifier_groups_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_modifier_groups_tenant ON public.modifier_groups USING btree (tenant_id);


--
-- Name: idx_modifiers_group; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_modifiers_group ON public.modifiers USING btree (group_id);


--
-- Name: idx_modifiers_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_modifiers_tenant ON public.modifiers USING btree (tenant_id);


--
-- Name: idx_order_items_ready; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_order_items_ready ON public.order_items USING btree (order_id) WHERE (prep_status = 'ready'::text);


--
-- Name: idx_order_items_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_order_items_tenant ON public.order_items USING btree (tenant_id);


--
-- Name: idx_order_items_tenant_product; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_order_items_tenant_product ON public.order_items USING btree (tenant_id, product_id);


--
-- Name: idx_orders_check; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_orders_check ON public.orders USING btree (check_id) WHERE (check_id IS NOT NULL);


--
-- Name: idx_orders_tenant_created_at; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_orders_tenant_created_at ON public.orders USING btree (tenant_id, created_at DESC);


--
-- Name: idx_orders_tenant_session_status; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_orders_tenant_session_status ON public.orders USING btree (tenant_id, session_id, status);


--
-- Name: idx_payment_items_order_item; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_payment_items_order_item ON public.payment_items USING btree (order_item_id);


--
-- Name: idx_payment_items_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_payment_items_tenant ON public.payment_items USING btree (tenant_id);


--
-- Name: idx_payments_check; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_payments_check ON public.payments USING btree (check_id);


--
-- Name: idx_payments_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_payments_tenant ON public.payments USING btree (tenant_id);


--
-- Name: idx_pmg_group; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_pmg_group ON public.product_modifier_groups USING btree (group_id);


--
-- Name: idx_pmg_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_pmg_tenant ON public.product_modifier_groups USING btree (tenant_id);


--
-- Name: idx_print_settings_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_print_settings_tenant ON public.print_settings USING btree (tenant_id);


--
-- Name: idx_products_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_products_tenant ON public.products USING btree (tenant_id);


--
-- Name: idx_reservation_tables_table; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_reservation_tables_table ON public.reservation_tables USING btree (table_id);


--
-- Name: idx_reservation_tables_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_reservation_tables_tenant ON public.reservation_tables USING btree (tenant_id);


--
-- Name: idx_reservations_cancel_requested; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_reservations_cancel_requested ON public.reservations USING btree (tenant_id, date) WHERE (cancel_requested_at IS NOT NULL);


--
-- Name: idx_reservations_check; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_reservations_check ON public.reservations USING btree (check_id) WHERE (check_id IS NOT NULL);


--
-- Name: idx_reservations_pending_phone; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_reservations_pending_phone ON public.reservations USING btree (tenant_id, "right"(regexp_replace(phone, '\D'::text, ''::text, 'g'::text), 10)) WHERE (status = 'requested'::text);


--
-- Name: idx_reservations_tenant_date; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_reservations_tenant_date ON public.reservations USING btree (tenant_id, date, shift_id);


--
-- Name: idx_room_elements_room; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_room_elements_room ON public.room_elements USING btree (room_id);


--
-- Name: idx_room_elements_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_room_elements_tenant ON public.room_elements USING btree (tenant_id);


--
-- Name: idx_sessions_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_sessions_tenant ON public.sessions USING btree (tenant_id);


--
-- Name: idx_takeaway_hours_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_takeaway_hours_tenant ON public.takeaway_hours USING btree (tenant_id, weekday);


--
-- Name: idx_takeaway_orders_pending_phone; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_takeaway_orders_pending_phone ON public.takeaway_orders USING btree (tenant_id, "right"(regexp_replace(phone, '\D'::text, ''::text, 'g'::text), 10)) WHERE (status = 'requested'::text);


--
-- Name: idx_takeaway_orders_pickup; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_takeaway_orders_pickup ON public.takeaway_orders USING btree (tenant_id, pickup_at);


--
-- Name: idx_users_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);


--
-- Name: idx_wa_msg_tenants_phone; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_wa_msg_tenants_phone ON public.whatsapp_message_tenants USING btree (to_phone, sent_at DESC);


--
-- Name: idx_whatsapp_due; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_whatsapp_due ON public.whatsapp_messages USING btree (tenant_id, next_attempt_at) WHERE (status = 'queued'::text);


--
-- Name: idx_whatsapp_ref; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_whatsapp_ref ON public.whatsapp_messages USING btree (tenant_id, ref_type, ref_id);


--
-- Name: idx_whatsapp_wa_id; Type: INDEX; Schema: public; Owner: colettas
--

CREATE INDEX idx_whatsapp_wa_id ON public.whatsapp_messages USING btree (wa_message_id) WHERE (wa_message_id IS NOT NULL);


--
-- Name: uniq_booking_shifts_tenant_name; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_booking_shifts_tenant_name ON public.booking_shifts USING btree (tenant_id, lower(name));


--
-- Name: uniq_checks_open_table; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_checks_open_table ON public.checks USING btree (table_id) WHERE ((status = 'open'::text) AND (table_id IS NOT NULL));


--
-- Name: uniq_checks_session_number; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_checks_session_number ON public.checks USING btree (session_id, number);


--
-- Name: uniq_copy_types_tenant_name; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_copy_types_tenant_name ON public.copy_types USING btree (tenant_id, name);


--
-- Name: uniq_courses_tenant_name; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_courses_tenant_name ON public.courses USING btree (tenant_id, lower(name));


--
-- Name: uniq_dining_tables_room_name; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_dining_tables_room_name ON public.dining_tables USING btree (room_id, lower(name));


--
-- Name: uniq_modifier_groups_tenant_name; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_modifier_groups_tenant_name ON public.modifier_groups USING btree (tenant_id, lower(name));


--
-- Name: uniq_order_items_order_position; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_order_items_order_position ON public.order_items USING btree (order_id, "position");


--
-- Name: uniq_orders_client_order_id; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_orders_client_order_id ON public.orders USING btree (tenant_id, client_order_id) WHERE (client_order_id IS NOT NULL);


--
-- Name: uniq_orders_device_seq; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_orders_device_seq ON public.orders USING btree (tenant_id, session_id, device_id, device_seq) WHERE (device_id IS NOT NULL);


--
-- Name: uniq_payment_items_payment_item; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_payment_items_payment_item ON public.payment_items USING btree (payment_id, order_item_id);


--
-- Name: uniq_reservations_external; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_reservations_external ON public.reservations USING btree (tenant_id, source, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: uniq_reservations_token; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_reservations_token ON public.reservations USING btree (public_token);


--
-- Name: uniq_rooms_tenant_name; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_rooms_tenant_name ON public.rooms USING btree (tenant_id, lower(name));


--
-- Name: uniq_sessions_open_per_tenant; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_sessions_open_per_tenant ON public.sessions USING btree (tenant_id) WHERE (end_time IS NULL);


--
-- Name: uniq_takeaway_orders_order; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_takeaway_orders_order ON public.takeaway_orders USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: uniq_takeaway_orders_token; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_takeaway_orders_token ON public.takeaway_orders USING btree (public_token);


--
-- Name: uniq_users_tenant_username; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_users_tenant_username ON public.users USING btree (tenant_id, username);


--
-- Name: uniq_whatsapp_case_event; Type: INDEX; Schema: public; Owner: colettas
--

CREATE UNIQUE INDEX uniq_whatsapp_case_event ON public.whatsapp_messages USING btree (tenant_id, ref_type, ref_id, event);


--
-- Name: app_feedback app_feedback_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: app_feedback app_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: booking_closures booking_closures_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.booking_closures
    ADD CONSTRAINT booking_closures_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.booking_shifts(id) ON DELETE CASCADE;


--
-- Name: booking_closures booking_closures_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.booking_closures
    ADD CONSTRAINT booking_closures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: booking_shifts booking_shifts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.booking_shifts
    ADD CONSTRAINT booking_shifts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: checks checks_merged_into_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.checks
    ADD CONSTRAINT checks_merged_into_fkey FOREIGN KEY (merged_into) REFERENCES public.checks(id);


--
-- Name: checks checks_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.checks
    ADD CONSTRAINT checks_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: checks checks_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.checks
    ADD CONSTRAINT checks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: checks checks_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.checks
    ADD CONSTRAINT checks_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.dining_tables(id);


--
-- Name: checks checks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.checks
    ADD CONSTRAINT checks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: copy_types copy_types_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.copy_types
    ADD CONSTRAINT copy_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: courses courses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: devices devices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: dining_tables dining_tables_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: dining_tables dining_tables_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.dining_tables
    ADD CONSTRAINT dining_tables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: modifier_groups modifier_groups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.modifier_groups
    ADD CONSTRAINT modifier_groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: modifiers modifiers_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.modifier_groups(id) ON DELETE CASCADE;


--
-- Name: modifiers modifiers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: orders orders_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_check_id_fkey FOREIGN KEY (check_id) REFERENCES public.checks(id);


--
-- Name: orders orders_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: orders orders_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id);


--
-- Name: orders orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payment_items payment_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- Name: payment_items payment_items_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: payment_items payment_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payments payments_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_check_id_fkey FOREIGN KEY (check_id) REFERENCES public.checks(id);


--
-- Name: payments payments_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payments payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: print_settings print_settings_copy_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.print_settings
    ADD CONSTRAINT print_settings_copy_type_id_fkey FOREIGN KEY (copy_type_id) REFERENCES public.copy_types(id) ON DELETE CASCADE;


--
-- Name: print_settings print_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.print_settings
    ADD CONSTRAINT print_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: product_modifier_groups product_modifier_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.product_modifier_groups
    ADD CONSTRAINT product_modifier_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.modifier_groups(id) ON DELETE CASCADE;


--
-- Name: product_modifier_groups product_modifier_groups_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.product_modifier_groups
    ADD CONSTRAINT product_modifier_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_modifier_groups product_modifier_groups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.product_modifier_groups
    ADD CONSTRAINT product_modifier_groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: products products_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: reservation_tables reservation_tables_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservation_tables
    ADD CONSTRAINT reservation_tables_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id) ON DELETE CASCADE;


--
-- Name: reservation_tables reservation_tables_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservation_tables
    ADD CONSTRAINT reservation_tables_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.dining_tables(id);


--
-- Name: reservation_tables reservation_tables_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservation_tables
    ADD CONSTRAINT reservation_tables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: reservations reservations_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_check_id_fkey FOREIGN KEY (check_id) REFERENCES public.checks(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reservations reservations_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.booking_shifts(id);


--
-- Name: reservations reservations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: room_elements room_elements_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.room_elements
    ADD CONSTRAINT room_elements_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: room_elements room_elements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.room_elements
    ADD CONSTRAINT room_elements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: rooms rooms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: sessions sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: settings settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: takeaway_hours takeaway_hours_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_hours
    ADD CONSTRAINT takeaway_hours_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: takeaway_orders takeaway_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_orders
    ADD CONSTRAINT takeaway_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: takeaway_orders takeaway_orders_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_orders
    ADD CONSTRAINT takeaway_orders_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: takeaway_orders takeaway_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_orders
    ADD CONSTRAINT takeaway_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: takeaway_orders takeaway_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.takeaway_orders
    ADD CONSTRAINT takeaway_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: whatsapp_message_tenants whatsapp_message_tenants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.whatsapp_message_tenants
    ADD CONSTRAINT whatsapp_message_tenants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: whatsapp_messages whatsapp_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: colettas
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: app_feedback; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_closures; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.booking_closures ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_shifts; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.booking_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: checks; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;

--
-- Name: copy_types; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.copy_types ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: devices; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

--
-- Name: dining_tables; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: app_feedback master_read; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY master_read ON public.app_feedback FOR SELECT TO standmanager_master USING (true);


--
-- Name: users master_read; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY master_read ON public.users FOR SELECT TO standmanager_master USING (true);


--
-- Name: whatsapp_messages master_read; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY master_read ON public.whatsapp_messages FOR SELECT TO standmanager_master USING (true);


--
-- Name: modifier_groups; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: modifiers; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_items; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.payment_items ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: print_settings; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: product_modifier_groups; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation_tables; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.reservation_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: reservations; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: room_elements; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.room_elements ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: takeaway_hours; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.takeaway_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: takeaway_orders; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.takeaway_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: app_feedback tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.app_feedback USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: audit_logs tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.audit_logs USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: booking_closures tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.booking_closures USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: booking_shifts tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.booking_shifts USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: checks tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.checks USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: copy_types tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.copy_types USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: courses tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.courses USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: devices tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.devices USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: dining_tables tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.dining_tables USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: modifier_groups tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.modifier_groups USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: modifiers tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.modifiers USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: order_items tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.order_items USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: orders tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.orders USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: payment_items tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.payment_items USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: payments tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.payments USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: print_settings tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.print_settings USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: product_modifier_groups tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.product_modifier_groups USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: products tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.products USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: reservation_tables tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.reservation_tables USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: reservations tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.reservations USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: room_elements tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.room_elements USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: rooms tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.rooms USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: sessions tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.sessions USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: settings tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.settings USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: takeaway_hours tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.takeaway_hours USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: takeaway_orders tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.takeaway_orders USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: users tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.users USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: whatsapp_messages tenant_isolation; Type: POLICY; Schema: public; Owner: colettas
--

CREATE POLICY tenant_isolation ON public.whatsapp_messages USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_messages; Type: ROW SECURITY; Schema: public; Owner: colettas
--

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO standmanager_app;
GRANT USAGE ON SCHEMA public TO standmanager_master;


--
-- Name: TABLE _migrations; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public._migrations TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public._migrations TO standmanager_master;


--
-- Name: SEQUENCE _migrations_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public._migrations_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public._migrations_id_seq TO standmanager_master;


--
-- Name: TABLE app_feedback; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.app_feedback TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.app_feedback TO standmanager_master;


--
-- Name: SEQUENCE app_feedback_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.app_feedback_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.app_feedback_id_seq TO standmanager_master;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT ON TABLE public.audit_logs TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_logs TO standmanager_master;


--
-- Name: SEQUENCE audit_logs_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.audit_logs_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.audit_logs_id_seq TO standmanager_master;


--
-- Name: TABLE booking_closures; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_closures TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_closures TO standmanager_master;


--
-- Name: SEQUENCE booking_closures_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.booking_closures_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.booking_closures_id_seq TO standmanager_master;


--
-- Name: TABLE booking_shifts; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_shifts TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_shifts TO standmanager_master;


--
-- Name: SEQUENCE booking_shifts_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.booking_shifts_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.booking_shifts_id_seq TO standmanager_master;


--
-- Name: TABLE checks; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.checks TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.checks TO standmanager_master;


--
-- Name: SEQUENCE checks_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.checks_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.checks_id_seq TO standmanager_master;


--
-- Name: TABLE copy_types; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.copy_types TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.copy_types TO standmanager_master;


--
-- Name: SEQUENCE copy_types_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.copy_types_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.copy_types_id_seq TO standmanager_master;


--
-- Name: TABLE courses; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.courses TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.courses TO standmanager_master;


--
-- Name: SEQUENCE courses_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.courses_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.courses_id_seq TO standmanager_master;


--
-- Name: TABLE devices; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.devices TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.devices TO standmanager_master;


--
-- Name: SEQUENCE devices_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.devices_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.devices_id_seq TO standmanager_master;


--
-- Name: TABLE dining_tables; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.dining_tables TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.dining_tables TO standmanager_master;


--
-- Name: SEQUENCE dining_tables_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.dining_tables_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.dining_tables_id_seq TO standmanager_master;


--
-- Name: TABLE modifier_groups; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.modifier_groups TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.modifier_groups TO standmanager_master;


--
-- Name: SEQUENCE modifier_groups_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.modifier_groups_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.modifier_groups_id_seq TO standmanager_master;


--
-- Name: TABLE modifiers; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.modifiers TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.modifiers TO standmanager_master;


--
-- Name: SEQUENCE modifiers_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.modifiers_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.modifiers_id_seq TO standmanager_master;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.order_items TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.order_items TO standmanager_master;


--
-- Name: SEQUENCE order_items_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.order_items_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.order_items_id_seq TO standmanager_master;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.orders TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.orders TO standmanager_master;


--
-- Name: SEQUENCE orders_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.orders_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.orders_id_seq TO standmanager_master;


--
-- Name: TABLE payment_items; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_items TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_items TO standmanager_master;


--
-- Name: SEQUENCE payment_items_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.payment_items_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.payment_items_id_seq TO standmanager_master;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payments TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payments TO standmanager_master;


--
-- Name: SEQUENCE payments_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.payments_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.payments_id_seq TO standmanager_master;


--
-- Name: TABLE print_settings; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.print_settings TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.print_settings TO standmanager_master;


--
-- Name: SEQUENCE print_settings_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.print_settings_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.print_settings_id_seq TO standmanager_master;


--
-- Name: TABLE product_modifier_groups; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_modifier_groups TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_modifier_groups TO standmanager_master;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.products TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.products TO standmanager_master;


--
-- Name: SEQUENCE products_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.products_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.products_id_seq TO standmanager_master;


--
-- Name: TABLE reservation_tables; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.reservation_tables TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.reservation_tables TO standmanager_master;


--
-- Name: TABLE reservations; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.reservations TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.reservations TO standmanager_master;


--
-- Name: SEQUENCE reservations_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.reservations_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.reservations_id_seq TO standmanager_master;


--
-- Name: TABLE room_elements; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.room_elements TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.room_elements TO standmanager_master;


--
-- Name: SEQUENCE room_elements_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.room_elements_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.room_elements_id_seq TO standmanager_master;


--
-- Name: TABLE rooms; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.rooms TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.rooms TO standmanager_master;


--
-- Name: SEQUENCE rooms_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.rooms_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.rooms_id_seq TO standmanager_master;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sessions TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sessions TO standmanager_master;


--
-- Name: SEQUENCE sessions_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.sessions_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.sessions_id_seq TO standmanager_master;


--
-- Name: TABLE settings; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.settings TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.settings TO standmanager_master;


--
-- Name: TABLE takeaway_hours; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.takeaway_hours TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.takeaway_hours TO standmanager_master;


--
-- Name: SEQUENCE takeaway_hours_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.takeaway_hours_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.takeaway_hours_id_seq TO standmanager_master;


--
-- Name: TABLE takeaway_orders; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.takeaway_orders TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.takeaway_orders TO standmanager_master;


--
-- Name: SEQUENCE takeaway_orders_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.takeaway_orders_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.takeaway_orders_id_seq TO standmanager_master;


--
-- Name: TABLE tenants; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT ON TABLE public.tenants TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tenants TO standmanager_master;


--
-- Name: SEQUENCE tenants_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.tenants_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.tenants_id_seq TO standmanager_master;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO standmanager_master;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.users_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.users_id_seq TO standmanager_master;


--
-- Name: TABLE whatsapp_message_tenants; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.whatsapp_message_tenants TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.whatsapp_message_tenants TO standmanager_master;


--
-- Name: TABLE whatsapp_messages; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.whatsapp_messages TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.whatsapp_messages TO standmanager_master;


--
-- Name: SEQUENCE whatsapp_messages_id_seq; Type: ACL; Schema: public; Owner: colettas
--

GRANT ALL ON SEQUENCE public.whatsapp_messages_id_seq TO standmanager_app;
GRANT SELECT,USAGE ON SEQUENCE public.whatsapp_messages_id_seq TO standmanager_master;


--
-- Name: TABLE whatsapp_optouts; Type: ACL; Schema: public; Owner: colettas
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.whatsapp_optouts TO standmanager_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.whatsapp_optouts TO standmanager_master;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: colettas
--

ALTER DEFAULT PRIVILEGES FOR ROLE colettas IN SCHEMA public GRANT ALL ON SEQUENCES TO standmanager_app;
ALTER DEFAULT PRIVILEGES FOR ROLE colettas IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO standmanager_master;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: colettas
--

ALTER DEFAULT PRIVILEGES FOR ROLE colettas IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO standmanager_app;
ALTER DEFAULT PRIVILEGES FOR ROLE colettas IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO standmanager_master;


--
-- PostgreSQL database dump complete
--

\unrestrict q6zdAwXbbrP30lntmIehXkdmAj8Cfvyno7NSpEW4aSQ5KRNKVnBopdjaV2b81av


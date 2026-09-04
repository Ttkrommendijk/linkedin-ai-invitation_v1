


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."company_size" AS ENUM (
    '1 - 100',
    '101 - 250',
    '251 - 500',
    '500 - 1000',
    '1001 - 2500',
    '2501 - 5000',
    '5001 - 10000',
    '10001 - 20000',
    '+ 20000'
);


ALTER TYPE "public"."company_size" OWNER TO "postgres";


CREATE TYPE "public"."deal_phase" AS ENUM (
    'identification',
    'confirmed',
    'first_meeting',
    'follow',
    'negotiation',
    'closed',
    'cancelled'
);


ALTER TYPE "public"."deal_phase" OWNER TO "postgres";


CREATE TYPE "public"."note_status" AS ENUM (
    'planned',
    'ready',
    'canceled'
);


ALTER TYPE "public"."note_status" OWNER TO "postgres";


CREATE TYPE "public"."note_type" AS ENUM (
    'note',
    'email',
    'whatsapp',
    'linkedin',
    'telefone',
    'meeting'
);


ALTER TYPE "public"."note_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."company_size_from_employee_number"("p_employee_number" "text") RETURNS "public"."company_size"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  v_text text;
  v_max bigint;
begin
  if p_employee_number is null or btrim(p_employee_number) = '' then
    return null;
  end if;

  v_text := lower(p_employee_number);

  v_text := regexp_replace(v_text, '([0-9]+)\s*mil', '\1000', 'g');
  v_text := regexp_replace(v_text, '([0-9]+)\s*k', '\1000', 'g');

  select max((m[1])::bigint)
    into v_max
  from regexp_matches(v_text, '([0-9]+)', 'g') as r(m);

  if v_max is null then
    return null;
  end if;

  return case
    when v_max between 1 and 100 then '1 - 100'::public.company_size
    when v_max between 101 and 250 then '101 - 250'::public.company_size
    when v_max between 251 and 500 then '251 - 500'::public.company_size
    when v_max between 501 and 1000 then '500 - 1000'::public.company_size
    when v_max between 1001 and 2500 then '1001 - 2500'::public.company_size
    when v_max between 2501 and 5000 then '2501 - 5000'::public.company_size
    when v_max between 5001 and 9999 then '5001 - 10000'::public.company_size
    when v_max between 10000 and 20000 then '10001 - 20000'::public.company_size
    else '+ 20000'::public.company_size
  end;
end;
$$;


ALTER FUNCTION "public"."company_size_from_employee_number"("p_employee_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_employee_number"("employee_text" "text") RETURNS TABLE("employee_min" integer, "employee_max" integer)
    LANGUAGE "sql" IMMUTABLE
    AS $$
with cleaned as (
    select
        lower(coalesce(employee_text, '')) as txt
)
,numbers as (
    select
        txt
       ,array_agg(
            case
                when m[1] like '%mil%' then
                    cast(nullif(regexp_replace(m[1], '[^0-9]', '', 'g'), '') as int) * 1000
                else
                    cast(nullif(regexp_replace(m[1], '[^0-9]', '', 'g'), '') as int)
            end
        ) as nums
    from cleaned
    cross join lateral regexp_matches(
        txt,
        '([0-9]+(?:[.,][0-9]{3})?\s*mil|[0-9]+(?:[.,][0-9]{3})?)',
        'g'
    ) as m
    group by
        txt
)
select
    case
        when txt ilike '%mais de%'
          or txt ilike '%+ de%' then nums[1] + 1
        when array_length(nums, 1) >= 2 then least(nums[1], nums[2])
        when array_length(nums, 1) = 1 then nums[1]
        else null
    end as employee_min
   ,case
        when txt ilike '%mais de%'
          or txt ilike '%+ de%' then null
        when array_length(nums, 1) >= 2 then greatest(nums[1], nums[2])
        when array_length(nums, 1) = 1 then nums[1]
        else null
    end as employee_max
from numbers;
$$;


ALTER FUNCTION "public"."parse_employee_number"("employee_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_company_set_company_size"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
    if new.employee_number is not null
       and (
            tg_op = 'INSERT'
            or new.employee_number is distinct from old.employee_number
       )
    then
        new.company_size :=
            public.company_size_from_employee_number(new.employee_number);
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."trg_company_set_company_size"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_company_size_from_employee_number"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_size public.company_size;
  v_employee_number text;
begin
  select c.employee_number
    into v_employee_number
  from public.company c
  where c.company_id = p_company_id;

  v_size := public.company_size_from_employee_number(v_employee_number);

  update public.company
     set company_size = v_size
   where company_id = p_company_id;
end;
$$;


ALTER FUNCTION "public"."update_company_size_from_employee_number"("p_company_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."campaign" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaign_name" "text",
    "campaign_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "color" "text",
    "archived" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."campaign" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company" (
    "company_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linkedin_id" "text",
    "company_name" "text",
    "employee_number" "text",
    "it_members" "text",
    "sector" "text",
    "city" "text",
    "archived" boolean DEFAULT false,
    "company_size" "public"."company_size"
);


ALTER TABLE "public"."company" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deal" (
    "deal_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deal_name" "text",
    "deal_description" "text",
    "deal_value" numeric,
    "company_id" "uuid",
    "deal_phase" "public"."deal_phase" NOT NULL,
    "main_contact_id" "uuid"
);


ALTER TABLE "public"."deal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deal_person" (
    "deal_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "person_id" "uuid" NOT NULL
);


ALTER TABLE "public"."deal_person" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."linkedin_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "linkedin_url" "text" NOT NULL,
    "full_name" "text",
    "company" "text",
    "headline" "text",
    "invited_at" timestamp with time zone,
    "generated_at" timestamp with time zone,
    "message" "text",
    "status" "text" DEFAULT 'generated'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "first_message" "text",
    "first_message_generated_at" timestamp with time zone,
    "first_message_sent_at" timestamp with time zone,
    "campaign" "text" DEFAULT ''::"text",
    "archived" boolean DEFAULT false NOT NULL,
    "language" "text" DEFAULT 'portuguese'::"text" NOT NULL,
    "accepted" boolean DEFAULT false NOT NULL,
    "uuid" "uuid" NOT NULL,
    "profile_scrape" "text",
    "message_count" integer DEFAULT 0 NOT NULL,
    "comments" "text",
    "company_id" "uuid",
    "phone" "text",
    "email" "text"
);


ALTER TABLE "public"."linkedin_invitations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."linkedin_invitations"."profile_scrape" IS 'the scraped data';



COMMENT ON COLUMN "public"."linkedin_invitations"."comments" IS 'manual added comments';



CREATE TABLE IF NOT EXISTS "public"."note" (
    "note_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note_title" "text",
    "note_description" "text",
    "creator" "uuid",
    "main_person_id" "uuid",
    "deal_id" "uuid",
    "status" "public"."note_status" DEFAULT 'ready'::"public"."note_status" NOT NULL,
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes_type" "public"."note_type" NOT NULL,
    "company_id" "uuid",
    "archived" boolean DEFAULT false NOT NULL,
    "duration" bigint
);


ALTER TABLE "public"."note" OWNER TO "postgres";


COMMENT ON COLUMN "public"."note"."duration" IS 'in minutes';



ALTER TABLE "public"."note" ALTER COLUMN "note_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."note_note_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."notes_view" WITH ("security_invoker"='on') AS
 SELECT "n"."note_id",
    "n"."note_title",
    "n"."note_description",
    "n"."duration",
    "n"."created_at",
    "n"."status",
    "n"."date",
    "n"."notes_type",
    "n"."main_person_id",
    "n"."company_id",
    "n"."deal_id",
    "p"."full_name" AS "person_name",
    "c"."company_name",
    "d"."deal_name",
    "d"."deal_description",
    "n"."archived"
   FROM ((("public"."note" "n"
     LEFT JOIN "public"."linkedin_invitations" "p" ON (("p"."id" = "n"."main_person_id")))
     LEFT JOIN "public"."company" "c" ON (("c"."company_id" = "n"."company_id")))
     LEFT JOIN "public"."deal" "d" ON (("d"."deal_id" = "n"."deal_id")));


ALTER VIEW "public"."notes_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_campaign" (
    "person_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaign_id" "uuid" NOT NULL
);


ALTER TABLE "public"."person_campaign" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt" (
    "prompt_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prompt_name" "text",
    "prompt_text" "text",
    "user_id" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."prompt" OWNER TO "postgres";


ALTER TABLE "public"."prompt" ALTER COLUMN "prompt_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."prompt_prompt_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."vw_company_overview" AS
SELECT
    NULL::"uuid" AS "company_id",
    NULL::"text" AS "company_name",
    NULL::"text" AS "linkedin_id",
    NULL::boolean AS "archived",
    NULL::"text" AS "sector",
    NULL::"text" AS "employee_number",
    NULL::"public"."company_size" AS "company_size",
    NULL::bigint AS "linked_person_count",
    NULL::bigint AS "accepted_person_count",
    NULL::bigint AS "accepted_strategic_it_count",
    NULL::bigint AS "accepted_operational_it_count",
    NULL::"text" AS "campaigns",
    NULL::bigint AS "customer_potential_score";


ALTER VIEW "public"."vw_company_overview" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_deals_overview" WITH ("security_invoker"='on') AS
 SELECT "d"."deal_id",
    "d"."created_at",
    "d"."deal_name",
    "d"."deal_description",
    "d"."deal_value",
    "d"."deal_phase",
    "d"."company_id",
    "d"."main_contact_id",
    "c"."company_name",
    "li"."id" AS "person_id",
    "li"."full_name" AS "person_name",
    "li"."linkedin_url" AS "person_linkedin_url"
   FROM (("public"."deal" "d"
     LEFT JOIN "public"."company" "c" ON (("c"."company_id" = "d"."company_id")))
     LEFT JOIN "public"."linkedin_invitations" "li" ON (("li"."id" = "d"."main_contact_id")))
  WHERE (COALESCE("c"."archived", false) = false);


ALTER VIEW "public"."vw_deals_overview" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_linkedin_invitations_overview" WITH ("security_invoker"='on') AS
 SELECT "i"."linkedin_url" AS "url",
    "i"."full_name" AS "name",
    "i"."company",
    "i"."headline",
    GREATEST(COALESCE("i"."first_message_sent_at", '-infinity'::timestamp with time zone), COALESCE("i"."first_message_generated_at", '-infinity'::timestamp with time zone), COALESCE("i"."accepted_at", '-infinity'::timestamp with time zone), COALESCE("i"."invited_at", '-infinity'::timestamp with time zone), COALESCE("i"."generated_at", '-infinity'::timestamp with time zone), COALESCE("i"."updated_at", '-infinity'::timestamp with time zone), COALESCE("i"."created_at", '-infinity'::timestamp with time zone)) AS "most_relevant_date",
    "i"."archived",
    "i"."campaign",
    "string_agg"(DISTINCT "cam"."campaign_name", ', '::"text" ORDER BY "cam"."campaign_name") AS "campaigns",
    "i"."status",
    "i"."accepted",
    "i"."uuid"
   FROM (("public"."linkedin_invitations" "i"
     LEFT JOIN "public"."person_campaign" "pc" ON (("pc"."person_id" = "i"."id")))
     LEFT JOIN "public"."campaign" "cam" ON (("cam"."campaign_id" = "pc"."campaign_id")))
  GROUP BY "i"."linkedin_url", "i"."full_name", "i"."company", "i"."headline", "i"."first_message_sent_at", "i"."first_message_generated_at", "i"."accepted_at", "i"."invited_at", "i"."generated_at", "i"."updated_at", "i"."created_at", "i"."archived", "i"."campaign", "i"."status", "i"."accepted", "i"."uuid";


ALTER VIEW "public"."vw_linkedin_invitations_overview" OWNER TO "postgres";


ALTER TABLE ONLY "public"."campaign"
    ADD CONSTRAINT "campaign_campaign_name_unique" UNIQUE ("campaign_name");



ALTER TABLE ONLY "public"."campaign"
    ADD CONSTRAINT "campaign_pkey" PRIMARY KEY ("campaign_id");



ALTER TABLE ONLY "public"."company"
    ADD CONSTRAINT "company_linkedin_id_key" UNIQUE ("linkedin_id");



ALTER TABLE ONLY "public"."company"
    ADD CONSTRAINT "company_pkey" PRIMARY KEY ("company_id");



ALTER TABLE ONLY "public"."deal_person"
    ADD CONSTRAINT "deal_person_pkey" PRIMARY KEY ("deal_id", "person_id");



ALTER TABLE ONLY "public"."deal"
    ADD CONSTRAINT "deal_pkey" PRIMARY KEY ("deal_id");



ALTER TABLE ONLY "public"."linkedin_invitations"
    ADD CONSTRAINT "linkedin_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_pkey" PRIMARY KEY ("note_id");



ALTER TABLE ONLY "public"."person_campaign"
    ADD CONSTRAINT "person_campaign_pkey" PRIMARY KEY ("person_id", "campaign_id");



ALTER TABLE ONLY "public"."prompt"
    ADD CONSTRAINT "prompt_pkey" PRIMARY KEY ("prompt_id");



CREATE UNIQUE INDEX "ix_linkedin_invitations_linkedin_url" ON "public"."linkedin_invitations" USING "btree" ("linkedin_url");



CREATE OR REPLACE VIEW "public"."vw_company_overview" WITH ("security_invoker"='on') AS
 SELECT "c"."company_id",
    "c"."company_name",
    "c"."linkedin_id",
    "c"."archived",
    "c"."sector",
    "c"."employee_number",
    "c"."company_size",
    "count"(DISTINCT "li"."id") AS "linked_person_count",
    "count"(DISTINCT "li"."id") FILTER (WHERE ("li"."accepted" = true)) AS "accepted_person_count",
    "count"(DISTINCT "li"."id") FILTER (WHERE (("li"."accepted" = true) AND ("li"."headline" ~* '(cio|diretor.*ti|head.*ti|gerente.*ti)'::"text"))) AS "accepted_strategic_it_count",
    "count"(DISTINCT "li"."id") FILTER (WHERE (("li"."accepted" = true) AND ("li"."headline" ~* '(coordenador.*ti|supervisor.*ti|analista.*ti)'::"text"))) AS "accepted_operational_it_count",
    "string_agg"(DISTINCT "cam"."campaign_name", ', '::"text" ORDER BY "cam"."campaign_name") AS "campaigns",
    (((
        CASE
            WHEN ("p"."employee_min" IS NULL) THEN 0
            WHEN (("p"."employee_min" <= 5000) AND (COALESCE("p"."employee_max", "p"."employee_min") >= 1000)) THEN 60
            WHEN (("p"."employee_min" <= 999) AND (COALESCE("p"."employee_max", "p"."employee_min") >= 501)) THEN 45
            WHEN (("p"."employee_min" <= 10000) AND (COALESCE("p"."employee_max", "p"."employee_min") >= 5001)) THEN 35
            WHEN ("p"."employee_min" > 10000) THEN 20
            WHEN (("p"."employee_min" <= 500) AND (COALESCE("p"."employee_max", "p"."employee_min") >= 201)) THEN 30
            WHEN (("p"."employee_min" <= 200) AND (COALESCE("p"."employee_max", "p"."employee_min") >= 51)) THEN 20
            WHEN (("p"."employee_min" <= 50) AND (COALESCE("p"."employee_max", "p"."employee_min") >= 11)) THEN 10
            ELSE 5
        END + LEAST((COALESCE("count"(DISTINCT "li"."id") FILTER (WHERE ("li"."accepted" = true)), (0)::bigint) * 4), (20)::bigint)) + LEAST((COALESCE("count"(DISTINCT "li"."id") FILTER (WHERE (("li"."accepted" = true) AND ("li"."headline" ~* '(cio|diretor.*ti|head.*ti|gerente.*ti)'::"text"))), (0)::bigint) * 15), (30)::bigint)) + LEAST((COALESCE("count"(DISTINCT "li"."id") FILTER (WHERE (("li"."accepted" = true) AND ("li"."headline" ~* '(coordenador.*ti|supervisor.*ti|analista.*ti)'::"text"))), (0)::bigint) * 6), (12)::bigint)) AS "customer_potential_score"
   FROM (((("public"."company" "c"
     LEFT JOIN "public"."linkedin_invitations" "li" ON (("li"."company_id" = "c"."company_id")))
     LEFT JOIN "public"."person_campaign" "pc" ON (("pc"."person_id" = "li"."id")))
     LEFT JOIN "public"."campaign" "cam" ON (("cam"."campaign_id" = "pc"."campaign_id")))
     LEFT JOIN LATERAL "public"."parse_employee_number"("c"."employee_number") "p"("employee_min", "employee_max") ON (true))
  GROUP BY "c"."company_id", "c"."company_name", "c"."linkedin_id", "c"."archived", "p"."employee_min", "p"."employee_max";



CREATE OR REPLACE TRIGGER "trg_company_set_company_size" BEFORE INSERT OR UPDATE OF "employee_number" ON "public"."company" FOR EACH ROW EXECUTE FUNCTION "public"."trg_company_set_company_size"();



CREATE OR REPLACE TRIGGER "trg_linkedin_invitations_updated_at" BEFORE UPDATE ON "public"."linkedin_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."deal"
    ADD CONSTRAINT "deal_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."company"("company_id");



ALTER TABLE ONLY "public"."deal"
    ADD CONSTRAINT "deal_main_contact_id_fkey" FOREIGN KEY ("main_contact_id") REFERENCES "public"."linkedin_invitations"("id");



ALTER TABLE ONLY "public"."deal_person"
    ADD CONSTRAINT "deal_person_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id");



ALTER TABLE ONLY "public"."deal_person"
    ADD CONSTRAINT "deal_person_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."linkedin_invitations"("id");



ALTER TABLE ONLY "public"."linkedin_invitations"
    ADD CONSTRAINT "linkedin_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."company"("company_id");



ALTER TABLE ONLY "public"."linkedin_invitations"
    ADD CONSTRAINT "linkedin_invitations_uuid_fkey" FOREIGN KEY ("uuid") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."company"("company_id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_creator_fkey" FOREIGN KEY ("creator") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("deal_id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_main_person_id_fkey" FOREIGN KEY ("main_person_id") REFERENCES "public"."linkedin_invitations"("id");



ALTER TABLE ONLY "public"."person_campaign"
    ADD CONSTRAINT "person_campaign_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("campaign_id");



ALTER TABLE ONLY "public"."person_campaign"
    ADD CONSTRAINT "person_campaign_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."linkedin_invitations"("id");



CREATE POLICY "Read" ON "public"."linkedin_invitations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "admin" ON "public"."campaign" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "admin" ON "public"."deal" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "admin" ON "public"."note" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "admin" ON "public"."person_campaign" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can insert prompts" ON "public"."prompt" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated users can read prompts" ON "public"."prompt" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can update prompts" ON "public"."prompt" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."campaign" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_insert_anon" ON "public"."company" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "company_insert_auth" ON "public"."company" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "company_select_anon" ON "public"."company" FOR SELECT TO "anon" USING (true);



CREATE POLICY "company_select_authenticated" ON "public"."company" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "company_update_anon" ON "public"."company" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "company_update_auth" ON "public"."company" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."deal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deal_person" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "li_delete_own" ON "public"."linkedin_invitations" FOR DELETE TO "authenticated" USING (("uuid" = "auth"."uid"()));



CREATE POLICY "li_insert_own" ON "public"."linkedin_invitations" FOR INSERT TO "authenticated" WITH CHECK (("uuid" = "auth"."uid"()));



CREATE POLICY "li_select_own" ON "public"."linkedin_invitations" FOR SELECT TO "authenticated" USING (("uuid" = "auth"."uid"()));



CREATE POLICY "li_update_own" ON "public"."linkedin_invitations" FOR UPDATE TO "authenticated" USING (("uuid" = "auth"."uid"())) WITH CHECK (("uuid" = "auth"."uid"()));



ALTER TABLE "public"."linkedin_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."note" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "p_li_insert_anon" ON "public"."linkedin_invitations" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "p_li_update_anon" ON "public"."linkedin_invitations" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."person_campaign" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."company_size_from_employee_number"("p_employee_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."company_size_from_employee_number"("p_employee_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."company_size_from_employee_number"("p_employee_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_employee_number"("employee_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_employee_number"("employee_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_employee_number"("employee_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_company_set_company_size"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_company_set_company_size"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_company_set_company_size"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_company_size_from_employee_number"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_company_size_from_employee_number"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_company_size_from_employee_number"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."campaign" TO "anon";
GRANT ALL ON TABLE "public"."campaign" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign" TO "service_role";



GRANT ALL ON TABLE "public"."company" TO "anon";
GRANT ALL ON TABLE "public"."company" TO "authenticated";
GRANT ALL ON TABLE "public"."company" TO "service_role";



GRANT ALL ON TABLE "public"."deal" TO "anon";
GRANT ALL ON TABLE "public"."deal" TO "authenticated";
GRANT ALL ON TABLE "public"."deal" TO "service_role";



GRANT ALL ON TABLE "public"."deal_person" TO "anon";
GRANT ALL ON TABLE "public"."deal_person" TO "authenticated";
GRANT ALL ON TABLE "public"."deal_person" TO "service_role";



GRANT ALL ON TABLE "public"."linkedin_invitations" TO "anon";
GRANT ALL ON TABLE "public"."linkedin_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."linkedin_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."note" TO "anon";
GRANT ALL ON TABLE "public"."note" TO "authenticated";
GRANT ALL ON TABLE "public"."note" TO "service_role";



GRANT ALL ON SEQUENCE "public"."note_note_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."note_note_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."note_note_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notes_view" TO "anon";
GRANT ALL ON TABLE "public"."notes_view" TO "authenticated";
GRANT ALL ON TABLE "public"."notes_view" TO "service_role";



GRANT ALL ON TABLE "public"."person_campaign" TO "anon";
GRANT ALL ON TABLE "public"."person_campaign" TO "authenticated";
GRANT ALL ON TABLE "public"."person_campaign" TO "service_role";



GRANT ALL ON TABLE "public"."prompt" TO "anon";
GRANT ALL ON TABLE "public"."prompt" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prompt_prompt_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prompt_prompt_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prompt_prompt_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vw_company_overview" TO "anon";
GRANT ALL ON TABLE "public"."vw_company_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_company_overview" TO "service_role";



GRANT ALL ON TABLE "public"."vw_deals_overview" TO "anon";
GRANT ALL ON TABLE "public"."vw_deals_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_deals_overview" TO "service_role";



GRANT ALL ON TABLE "public"."vw_linkedin_invitations_overview" TO "anon";
GRANT ALL ON TABLE "public"."vw_linkedin_invitations_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_linkedin_invitations_overview" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








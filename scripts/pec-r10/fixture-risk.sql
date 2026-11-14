-- F4 fixture additions (SYNTHETIC; NEVER production): live-faithful schema details needed to run the
-- real approval / vendor bulk writer bodies (fixture-live-defs.sql) and to characterise R-1/R-2/R-3.
\set ON_ERROR_STOP on

-- Live FK observed 14 Nov 2026: proc_indent_line.indent_id -> proc_indent_header ON DELETE CASCADE.
-- It matters: a direct INSERT of a line takes a FOR KEY SHARE lock on the parent header row, which
-- conflicts with the resync's header FOR UPDATE.
ALTER TABLE public.proc_indent_line
  ADD CONSTRAINT proc_indent_line_indent_id_fkey FOREIGN KEY (indent_id) REFERENCES public.proc_indent_header(indent_id) ON DELETE CASCADE;
ALTER TABLE public.proc_indent_header ADD COLUMN approved_date date, ADD COLUMN approved_at timestamptz, ADD COLUMN issued_date date;

-- Minimal vendor-sourcing model. The live balance view's definition is NOT reproduced: this view is a
-- stand-in (published = approved/issued, remaining = requested). Locking behaviour of the real writer
-- bodies is unaffected because they lock the same tables regardless of the view's internals.
CREATE TABLE public.proc_vendor (vendor_id bigint PRIMARY KEY, is_active boolean NOT NULL);
CREATE TABLE public.inv_stock_item (id bigint PRIMARY KEY);
CREATE TABLE public.inv_uom (id bigint PRIMARY KEY);
CREATE TABLE public.inv_class_category (id bigint PRIMARY KEY);
CREATE TABLE public.proc_indent_line_sourcing_decision (
  indent_line_id bigint NOT NULL, recommended_vendor_id bigint, recommended_rate numeric, recommended_source text,
  recommended_meta jsonb NOT NULL DEFAULT '[]'::jsonb, selected_vendor_id bigint, selected_rate numeric, selection_reason text,
  decided_at timestamptz, decided_by uuid, vendor_assignment_cleared boolean NOT NULL DEFAULT false,
  CONSTRAINT proc_indent_line_sourcing_decision_pkey PRIMARY KEY (indent_line_id)
);
CREATE VIEW public.v_proc_published_indent_line_balance AS
  SELECT l.indent_line_id, l.indent_id, l.material_class_id, l.stock_item_id, l.requested_qty AS remaining_qty
    FROM public.proc_indent_line l JOIN public.proc_indent_header h ON h.indent_id = l.indent_id
   WHERE h.status IN ('approved', 'issued');
INSERT INTO public.inv_stock_item(id) VALUES (11),(13),(14),(80),(91);
INSERT INTO public.inv_uom(id) VALUES (1);
INSERT INTO public.inv_class_category(id) VALUES (1);
INSERT INTO public.proc_vendor(vendor_id, is_active) VALUES (7, true), (8, true);

-- Deterministic pause points, active only for application 'sess_A' and only when the GUC is set.
-- Statement-level: fires BEFORE the header UPDATE starts (no row lock held yet) = the stale-decision window.
CREATE FUNCTION public.fx_hdr_pause_stmt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('application_name') = 'sess_A' AND coalesce(current_setting('fx.pause_hdr_stmt', true), '') = 'on' THEN
    PERFORM pg_advisory_lock(777); PERFORM pg_advisory_unlock(777);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER fx_hdr_pause_stmt_trg BEFORE UPDATE ON public.proc_indent_header FOR EACH STATEMENT EXECUTE FUNCTION public.fx_hdr_pause_stmt();
-- Row-level: fires after the row is locked, for one named indent = the session holds that header row while paused.
CREATE FUNCTION public.fx_hdr_pause_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('application_name') = 'sess_A' AND coalesce(current_setting('fx.pause_hdr_row', true), '') = NEW.indent_id::text THEN
    PERFORM pg_advisory_lock(777); PERFORM pg_advisory_unlock(777);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fx_hdr_pause_row_trg BEFORE UPDATE ON public.proc_indent_header FOR EACH ROW EXECUTE FUNCTION public.fx_hdr_pause_row();

-- Risk seed: base + extras + indent 31 (draft, source PR 500, three PR-derived mapped lines).
CREATE FUNCTION public.fx_seed_risk() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  TRUNCATE public.proc_indent_line_sourcing_decision;
  TRUNCATE public.fx_header_audit RESTART IDENTITY;
  PERFORM public.fx_seed();
  PERFORM public.fx_seed_extra();
  INSERT INTO public.proc_indent_header(indent_id, status, source_pr_id) VALUES (31, 'draft', 500);
  INSERT INTO public.proc_indent_line(indent_line_id, indent_id, material_class_id, stock_item_id, uom_id, requested_qty, manual_reason) OVERRIDING SYSTEM VALUE VALUES
    (3101, 31, 1, 11, 1, 3, NULL), (3102, 31, 1, 14, 1, 2, 'PR500 14'), (3103, 31, 1, 13, 1, 6, 'PR500 13');
  INSERT INTO public.proc_pr_indent_line_map(indent_id, indent_line_id, pr_id, pr_line_id) VALUES (31, 3101, 500, 5001), (31, 3102, 500, 5002), (31, 3103, 500, 5003);
  INSERT INTO public.proc_pr_to_indent_map(pr_id, indent_id, is_active, note) VALUES (500, 31, true, 'risk');
END $$;

-- Header status-transition audit model (the live lifecycle-audit trigger writes an audit row per change).
CREATE TABLE public.fx_header_audit (seq bigserial PRIMARY KEY, indent_id bigint, old_status text, new_status text);
CREATE FUNCTION public.fx_header_audit_trg() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.fx_header_audit(indent_id, old_status, new_status) VALUES (NEW.indent_id, OLD.status, NEW.status);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER fx_header_audit_trg AFTER UPDATE ON public.proc_indent_header FOR EACH ROW EXECUTE FUNCTION public.fx_header_audit_trg();

-- Faithful lock footprint of the live snapshot refresh: proc_request_snapshot_refresh_pec_internal takes
-- pg_advisory_xact_lock(hashtext('procurement_snapshot_refresh_request')) (held to commit). Every writer that
-- calls it does so AFTER its header lock/UPDATE, so the global lock is always last in the lock order.
CREATE OR REPLACE FUNCTION public.proc_request_snapshot_refresh(text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('procurement_snapshot_refresh_request'));
END $$;

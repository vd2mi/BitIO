-- run this in Supabase SQL Editor before testing

-- get the role of whoever is logged in, bypassing RLS so we don't get a circular reference
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE email = auth.jwt() ->> 'email';
$$;

CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE email = auth.jwt() ->> 'email';
$$;

-- categories: anyone can read, only admins can write
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories public read" ON public.categories;
DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- products: anyone can read, only admins can write
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products public read" ON public.products;
DROP POLICY IF EXISTS "products admin write" ON public.products;
CREATE POLICY "products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- product_specs: public read
ALTER TABLE public.product_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "specs public read" ON public.product_specs;
DROP POLICY IF EXISTS "specs admin write" ON public.product_specs;
CREATE POLICY "specs public read" ON public.product_specs FOR SELECT USING (true);
CREATE POLICY "specs admin write" ON public.product_specs FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- product_hotspots: public read
ALTER TABLE public.product_hotspots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hotspots public read" ON public.product_hotspots;
DROP POLICY IF EXISTS "hotspots admin write" ON public.product_hotspots;
CREATE POLICY "hotspots public read" ON public.product_hotspots FOR SELECT USING (true);
CREATE POLICY "hotspots admin write" ON public.product_hotspots FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- product_sales_metrics: public read
ALTER TABLE public.product_sales_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metrics public read" ON public.product_sales_metrics;
DROP POLICY IF EXISTS "metrics admin write" ON public.product_sales_metrics;
CREATE POLICY "metrics public read" ON public.product_sales_metrics FOR SELECT USING (true);
CREATE POLICY "metrics admin write" ON public.product_sales_metrics FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- users: each user can only see/edit their own row, admins can see everyone
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own row select" ON public.users;
DROP POLICY IF EXISTS "users own row insert" ON public.users;
DROP POLICY IF EXISTS "users own row update" ON public.users;
DROP POLICY IF EXISTS "admin users full"     ON public.users;
CREATE POLICY "users own row select" ON public.users FOR SELECT TO authenticated
  USING (email = auth.jwt() ->> 'email');
CREATE POLICY "users own row insert" ON public.users FOR INSERT TO authenticated
  WITH CHECK (email = auth.jwt() ->> 'email');
CREATE POLICY "users own row update" ON public.users FOR UPDATE TO authenticated
  USING (email = auth.jwt() ->> 'email') WITH CHECK (email = auth.jwt() ->> 'email');
CREATE POLICY "admin users full" ON public.users FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- user_addresses: own rows only
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addresses own rows" ON public.user_addresses;
DROP POLICY IF EXISTS "addresses admin"    ON public.user_addresses;
CREATE POLICY "addresses own rows" ON public.user_addresses FOR ALL TO authenticated
  USING (user_id = get_my_user_id()) WITH CHECK (user_id = get_my_user_id());
CREATE POLICY "addresses admin" ON public.user_addresses FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- user_notification_prefs: own row only
ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif prefs own row" ON public.user_notification_prefs;
CREATE POLICY "notif prefs own row" ON public.user_notification_prefs FOR ALL TO authenticated
  USING (user_id = get_my_user_id()) WITH CHECK (user_id = get_my_user_id());

-- user_sessions: own rows only
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions own rows" ON public.user_sessions;
DROP POLICY IF EXISTS "sessions admin"   ON public.user_sessions;
CREATE POLICY "sessions own rows" ON public.user_sessions FOR ALL TO authenticated
  USING (user_id = get_my_user_id()) WITH CHECK (user_id = get_my_user_id());
CREATE POLICY "sessions admin" ON public.user_sessions FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- orders: own orders only
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders own rows" ON public.orders;
DROP POLICY IF EXISTS "orders admin"    ON public.orders;
CREATE POLICY "orders own rows" ON public.orders FOR ALL TO authenticated
  USING (customer_id = get_my_user_id()) WITH CHECK (customer_id = get_my_user_id());
CREATE POLICY "orders admin" ON public.orders FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- order_items: accessible through your own orders
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order items own"   ON public.order_items;
DROP POLICY IF EXISTS "order items admin" ON public.order_items;
CREATE POLICY "order items own" ON public.order_items FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE customer_id = get_my_user_id()))
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE customer_id = get_my_user_id()));
CREATE POLICY "order items admin" ON public.order_items FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- returns: own returns only
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "returns own rows" ON public.returns;
DROP POLICY IF EXISTS "returns admin"    ON public.returns;
CREATE POLICY "returns own rows" ON public.returns FOR ALL TO authenticated
  USING (customer_id = get_my_user_id()) WITH CHECK (customer_id = get_my_user_id());
CREATE POLICY "returns admin" ON public.returns FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

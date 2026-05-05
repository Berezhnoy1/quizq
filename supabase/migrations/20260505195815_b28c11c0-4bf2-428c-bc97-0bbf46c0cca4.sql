
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_name TEXT,
  phone TEXT,
  email TEXT,
  appliances TEXT[] DEFAULT '{}',
  areas TEXT[] DEFAULT '{}',
  team_size TEXT,
  lead_source TEXT,
  booked_date DATE,
  booked_time TIME,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  status TEXT NOT NULL DEFAULT 'new'
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Public can insert (lead form). No public read.
CREATE POLICY "Anyone can submit application"
  ON public.submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

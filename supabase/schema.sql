-- ICT Experts - Supabase Schema with RLS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) >= 2),
  student_code TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','student')) DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_student_code ON public.profiles(student_code);

CREATE TABLE IF NOT EXISTS public.papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_name TEXT NOT NULL CHECK (char_length(paper_name) >= 3),
  paper_type TEXT NOT NULL CHECK (paper_type IN ('Past Paper','Model Paper','School Term Test','Monthly Test','Other')) DEFAULT 'Model Paper',
  category TEXT NOT NULL DEFAULT 'ICT',
  max_marks INTEGER NOT NULL CHECK (max_marks > 0 AND max_marks <= 1000),
  exam_date DATE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_papers_type ON public.papers(paper_type);
CREATE INDEX IF NOT EXISTS idx_papers_exam_date ON public.papers(exam_date DESC);

CREATE TABLE IF NOT EXISTS public.results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  marks_obtained INTEGER NOT NULL CHECK (marks_obtained >= 0),
  attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  entered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(student_id, paper_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_results_student ON public.results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_paper ON public.results(paper_id);

CREATE OR REPLACE FUNCTION check_marks_valid() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.marks_obtained > (SELECT max_marks FROM public.papers WHERE id = NEW.paper_id) THEN
    RAISE EXCEPTION 'marks_obtained exceeds max_marks';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_check_marks ON public.results;
CREATE TRIGGER trg_check_marks BEFORE INSERT OR UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION check_marks_valid();

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles; CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_papers_updated ON public.papers; CREATE TRIGGER trg_papers_updated BEFORE UPDATE ON public.papers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_results_updated ON public.results; CREATE TRIGGER trg_results_updated BEFORE UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
CREATE POLICY "Admin can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Users can update own profile limited" ON public.profiles;
CREATE POLICY "Users can update own profile limited" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE USING (public.is_admin());
DROP POLICY IF EXISTS "Allow signup profile creation" ON public.profiles;
CREATE POLICY "Allow signup profile creation" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated can read papers" ON public.papers;
CREATE POLICY "Authenticated can read papers" ON public.papers FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin can manage papers" ON public.papers;
CREATE POLICY "Admin can manage papers" ON public.papers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Students can view own results, admin all" ON public.results;
CREATE POLICY "Students can view own results, admin all" ON public.results FOR SELECT USING (student_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Students can insert own results" ON public.results;
CREATE POLICY "Students can insert own results" ON public.results FOR INSERT WITH CHECK (student_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Students can update own results, admin all" ON public.results;
CREATE POLICY "Students can update own results, admin all" ON public.results FOR UPDATE USING (student_id = auth.uid() OR public.is_admin()) WITH CHECK (student_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Admin can delete results" ON public.results;
CREATE POLICY "Admin can delete results" ON public.results FOR DELETE USING (public.is_admin());

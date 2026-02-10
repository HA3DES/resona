-- Fix: Restrict sections RLS policies to authenticated users only
-- Drop existing policies that allow anonymous access
DROP POLICY IF EXISTS "Users can view sections of their projects" ON public.sections;
DROP POLICY IF EXISTS "Users can delete sections in their projects" ON public.sections;
DROP POLICY IF EXISTS "Users can update sections in their projects" ON public.sections;
DROP POLICY IF EXISTS "Users can create sections in their projects" ON public.sections;

-- Recreate with explicit 'TO authenticated' restriction
CREATE POLICY "Users can view sections of their projects"
ON public.sections FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = sections.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can create sections in their projects"
ON public.sections FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = sections.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update sections in their projects"
ON public.sections FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = sections.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete sections in their projects"
ON public.sections FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = sections.project_id AND projects.user_id = auth.uid()));
-- ==============================================================================
-- FOODIEBITE HEALTH CHECK-IN & AI WELLNESS INSIGHTS MIGRATION
-- Migration: 20261126000010_health_checkins_and_insights.sql
-- Target: PostgreSQL 15+ (Supabase)
-- Description:
--   1. public.health_checkins: Root entity for user health & wellness check-ins
--   2. public.checkin_questions: Exact questions (standard + AI-generated) per check-in
--   3. public.checkin_answers: Permanent record of user answers per question
--   4. public.checkin_ai_analyses: Structured Ollama AI wellness analysis per check-in
--   5. public.health_trend_analyses: Aggregated historical multi-check-in trend records
-- Security:
--   - Row Level Security (RLS) enabled on all 5 tables
--   - Tenant isolation: auth.uid() = user_id
--   - Administrator override governed by public.is_admin() or service_role
--   - Cascading referential integrity to public.profiles(id)
--   - B-tree and GIN indexing for queries, date filtering, and status checks
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. HEALTH CHECK-INS (public.health_checkins)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    survey_version TEXT NOT NULL DEFAULT '1.0.0',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'analysis_pending', 'analyzed', 'analysis_failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    ai_analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK (ai_analysis_status IN ('pending', 'analyzed', 'failed', 'fallback_used')),
    ai_analysis_version TEXT NOT NULL DEFAULT '1.0.0',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_health_checkins_user_created 
    ON public.health_checkins (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_checkins_status 
    ON public.health_checkins (status, ai_analysis_status);

CREATE INDEX IF NOT EXISTS idx_health_checkins_completed 
    ON public.health_checkins (completed_at DESC) 
    WHERE completed_at IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. SURVEY QUESTIONS (public.checkin_questions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id UUID NOT NULL REFERENCES public.health_checkins(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_category TEXT NOT NULL CHECK (question_category IN (
        'general_wellness', 'energy', 'sleep', 'hydration', 'diet', 
        'digestion', 'activity', 'mood_stress', 'goals', 'additional_feedback', 'dynamic_followup'
    )),
    question_type TEXT NOT NULL CHECK (question_type IN ('rating', 'single_choice', 'multiple_choice', 'number', 'text')),
    options JSONB DEFAULT '[]'::jsonb,
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_checkin_questions_checkin 
    ON public.checkin_questions (checkin_id, sequence_order ASC);

CREATE INDEX IF NOT EXISTS idx_checkin_questions_ai_gen 
    ON public.checkin_questions (checkin_id, is_ai_generated);

-- ------------------------------------------------------------------------------
-- 3. SURVEY ANSWERS (public.checkin_answers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id UUID NOT NULL REFERENCES public.health_checkins(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.checkin_questions(id) ON DELETE CASCADE,
    original_question_text TEXT NOT NULL,
    answer_value JSONB NOT NULL,
    answer_type TEXT NOT NULL DEFAULT 'text',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_checkin_question_answer UNIQUE (checkin_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_answers_checkin 
    ON public.checkin_answers (checkin_id);

CREATE INDEX IF NOT EXISTS idx_checkin_answers_question 
    ON public.checkin_answers (question_id);

-- ------------------------------------------------------------------------------
-- 4. AI WELLNESS ANALYSES (public.checkin_ai_analyses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id UUID NOT NULL UNIQUE REFERENCES public.health_checkins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wellness_summary TEXT NOT NULL,
    current_observations JSONB DEFAULT '[]'::jsonb,
    observed_patterns JSONB DEFAULT '[]'::jsonb,
    positive_trends JSONB DEFAULT '[]'::jsonb,
    declining_trends JSONB DEFAULT '[]'::jsonb,
    areas_to_monitor JSONB DEFAULT '[]'::jsonb,
    sleep_observations JSONB DEFAULT '[]'::jsonb,
    energy_observations JSONB DEFAULT '[]'::jsonb,
    diet_observations JSONB DEFAULT '[]'::jsonb,
    hydration_observations JSONB DEFAULT '[]'::jsonb,
    activity_observations JSONB DEFAULT '[]'::jsonb,
    dietary_suggestions JSONB DEFAULT '[]'::jsonb,
    recommended_food_categories JSONB DEFAULT '[]'::jsonb,
    trend_assessment TEXT NOT NULL DEFAULT 'Stable' CHECK (trend_assessment IN ('Improving', 'Stable', 'Declining', 'Fluctuating', 'Baseline')),
    confidence_limitations TEXT DEFAULT 'Based strictly on user self-reported information and wellness metrics.',
    medical_disclaimer TEXT NOT NULL DEFAULT 'This analysis provides general nutritional and lifestyle guidance based on self-reported information. It is not a medical diagnosis or clinical prescription.',
    model_name TEXT NOT NULL DEFAULT 'ollama:qwen2.5:0.5b',
    analysis_version TEXT NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_checkin_ai_analyses_user 
    ON public.checkin_ai_analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkin_ai_analyses_checkin 
    ON public.checkin_ai_analyses (checkin_id);

-- ------------------------------------------------------------------------------
-- 5. HISTORICAL TREND ANALYSES (public.health_trend_analyses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.health_trend_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    analysis_period TEXT NOT NULL DEFAULT 'all_time',
    checkin_count INTEGER NOT NULL DEFAULT 1,
    trend_summary TEXT NOT NULL,
    improvements JSONB DEFAULT '[]'::jsonb,
    declining_trends JSONB DEFAULT '[]'::jsonb,
    areas_to_monitor JSONB DEFAULT '[]'::jsonb,
    dietary_recommendations JSONB DEFAULT '[]'::jsonb,
    model_name TEXT NOT NULL DEFAULT 'ollama:qwen2.5:0.5b',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_health_trend_analyses_user 
    ON public.health_trend_analyses (user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.health_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_trend_analyses ENABLE ROW LEVEL SECURITY;

-- Helper check if function is_admin exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR email = 'sham111205s@gmail.com')
  );
$$;

-- RLS: health_checkins
CREATE POLICY "Users can view own checkins" 
    ON public.health_checkins FOR SELECT 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create own checkins" 
    ON public.health_checkins FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update own checkins" 
    ON public.health_checkins FOR UPDATE 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete own checkins" 
    ON public.health_checkins FOR DELETE 
    USING (auth.uid() = user_id OR public.is_admin());

-- RLS: checkin_questions (linked via checkin_id)
CREATE POLICY "Users can view checkin questions" 
    ON public.checkin_questions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.health_checkins c 
            WHERE c.id = checkin_questions.checkin_id 
              AND (c.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Users or services can insert checkin questions" 
    ON public.checkin_questions FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.health_checkins c 
            WHERE c.id = checkin_questions.checkin_id 
              AND (c.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Users or services can update checkin questions" 
    ON public.checkin_questions FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.health_checkins c 
            WHERE c.id = checkin_questions.checkin_id 
              AND (c.user_id = auth.uid() OR public.is_admin())
        )
    );

-- RLS: checkin_answers
CREATE POLICY "Users can view own checkin answers" 
    ON public.checkin_answers FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.health_checkins c 
            WHERE c.id = checkin_answers.checkin_id 
              AND (c.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Users can insert own checkin answers" 
    ON public.checkin_answers FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.health_checkins c 
            WHERE c.id = checkin_answers.checkin_id 
              AND (c.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Users can update own checkin answers" 
    ON public.checkin_answers FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.health_checkins c 
            WHERE c.id = checkin_answers.checkin_id 
              AND (c.user_id = auth.uid() OR public.is_admin())
        )
    );

-- RLS: checkin_ai_analyses
CREATE POLICY "Users can view own checkin analyses" 
    ON public.checkin_ai_analyses FOR SELECT 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users or system can insert checkin analyses" 
    ON public.checkin_ai_analyses FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users or system can update checkin analyses" 
    ON public.checkin_ai_analyses FOR UPDATE 
    USING (auth.uid() = user_id OR public.is_admin());

-- RLS: health_trend_analyses
CREATE POLICY "Users can view own trend analyses" 
    ON public.health_trend_analyses FOR SELECT 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users or system can insert trend analyses" 
    ON public.health_trend_analyses FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

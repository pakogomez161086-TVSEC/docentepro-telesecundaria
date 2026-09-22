CREATE TABLE public.observaciones_clase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE SET NULL,
  alumno_id UUID REFERENCES public.alumnos(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  campo_formativo TEXT,
  momento TEXT NOT NULL DEFAULT 'desarrollo',
  contexto TEXT,
  observacion TEXT NOT NULL,
  fortalezas TEXT,
  areas_mejora TEXT,
  acuerdos TEXT,
  nivel_logro INTEGER NOT NULL DEFAULT 3 CHECK (nivel_logro BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.observaciones_clase TO authenticated;
GRANT ALL ON public.observaciones_clase TO service_role;
ALTER TABLE public.observaciones_clase ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docente gestiona sus observaciones" ON public.observaciones_clase
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.expediente_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'academico',
  titulo TEXT NOT NULL,
  descripcion TEXT,
  acuerdo TEXT,
  confidencial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expediente_notas TO authenticated;
GRANT ALL ON public.expediente_notas TO service_role;
ALTER TABLE public.expediente_notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docente gestiona expediente" ON public.expediente_notas
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.portafolio_evidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  campo_formativo TEXT,
  tipo TEXT NOT NULL DEFAULT 'producto',
  url TEXT,
  trimestre INTEGER NOT NULL DEFAULT 1 CHECK (trimestre BETWEEN 1 AND 3),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  destacada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portafolio_evidencias TO authenticated;
GRANT ALL ON public.portafolio_evidencias TO service_role;
ALTER TABLE public.portafolio_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docente gestiona portafolio" ON public.portafolio_evidencias
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_observaciones_user ON public.observaciones_clase(user_id, fecha DESC);
CREATE INDEX idx_expediente_alumno ON public.expediente_notas(alumno_id, fecha DESC);
CREATE INDEX idx_portafolio_alumno ON public.portafolio_evidencias(alumno_id, fecha DESC);
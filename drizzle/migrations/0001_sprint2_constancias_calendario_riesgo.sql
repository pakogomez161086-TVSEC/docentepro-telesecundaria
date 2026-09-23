CREATE TABLE public.constancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alumno_id uuid REFERENCES public.alumnos(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'estudios',
  folio text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  destinatario text,
  cuerpo text,
  observaciones text,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.constancias TO authenticated;
GRANT ALL ON public.constancias TO service_role;
ALTER TABLE public.constancias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docente gestiona sus constancias" ON public.constancias FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin lee constancias" ON public.constancias FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));
CREATE INDEX idx_constancias_user_fecha ON public.constancias(user_id, fecha DESC);

CREATE TABLE public.calendario_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  fecha_fin date,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'actividad',
  descripcion text,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  recordatorio boolean NOT NULL DEFAULT false,
  completado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_eventos TO authenticated;
GRANT ALL ON public.calendario_eventos TO service_role;
ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docente gestiona sus eventos" ON public.calendario_eventos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_calendario_eventos_user_fecha ON public.calendario_eventos(user_id, fecha);

CREATE TABLE public.alertas_riesgo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alumno_id uuid NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  nivel text NOT NULL DEFAULT 'medio',
  puntaje numeric NOT NULL DEFAULT 0,
  factores text[] NOT NULL DEFAULT '{}',
  recomendaciones text[] NOT NULL DEFAULT '{}',
  resumen text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  atendida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_riesgo TO authenticated;
GRANT ALL ON public.alertas_riesgo TO service_role;
ALTER TABLE public.alertas_riesgo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docente gestiona sus alertas" ON public.alertas_riesgo FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin lee alertas" ON public.alertas_riesgo FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));
CREATE INDEX idx_alertas_riesgo_user_fecha ON public.alertas_riesgo(user_id, fecha DESC);
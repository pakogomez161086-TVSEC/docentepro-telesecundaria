CREATE TABLE public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  grado int NOT NULL CHECK (grado BETWEEN 1 AND 3),
  ciclo text NOT NULL DEFAULT '2026-2027',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos TO authenticated;
GRANT ALL ON public.grupos TO service_role;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grupos propios" ON public.grupos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.alumnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  nombre_completo text NOT NULL,
  curp text,
  tutor_nombre text,
  tutor_contacto text,
  codigo_acceso text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alumnos TO authenticated;
GRANT ALL ON public.alumnos TO service_role;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alumnos propios" ON public.alumnos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.calificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alumno_id uuid NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  trimestre int NOT NULL CHECK (trimestre BETWEEN 1 AND 3),
  campo_formativo text NOT NULL,
  disciplina text,
  calificacion numeric(4,1) NOT NULL CHECK (calificacion >= 0 AND calificacion <= 10),
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, trimestre, campo_formativo, disciplina)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calificaciones TO authenticated;
GRANT ALL ON public.calificaciones TO service_role;
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calificaciones propias" ON public.calificaciones FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.asistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alumno_id uuid NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT current_date,
  estado text NOT NULL DEFAULT 'presente' CHECK (estado IN ('presente','ausente','justificado','retardo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, fecha)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asistencias TO authenticated;
GRANT ALL ON public.asistencias TO service_role;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asistencias propias" ON public.asistencias FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER calificaciones_updated_at BEFORE UPDATE ON public.calificaciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
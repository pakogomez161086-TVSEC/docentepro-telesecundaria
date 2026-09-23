import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { llamarGemini } from "./ia.server";

const AlumnoResumen = z.object({
  alumno_id: z.string().min(1),
  nombre: z.string().min(1),
  promedio: z.number().nullable(),
  reprobadas: z.number().int().min(0),
  asistencia: z.number().min(0).max(100).nullable(),
  faltas: z.number().int().min(0),
  observaciones: z.number().int().min(0),
  evidencias: z.number().int().min(0),
  notas: z.array(z.string()).max(20).optional(),
});

export const analizarRiesgo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ alumnos: z.array(AlumnoResumen).min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const prompt = `Eres un consejero pedagógico de Telesecundaria (Nueva Escuela Mexicana, Fase 6).
Analiza el riesgo de rezago o abandono escolar de los siguientes alumnos a partir de sus indicadores reales.

${JSON.stringify(data.alumnos, null, 2)}

Criterios: promedio menor a 7 y asignaturas reprobadas indican riesgo académico; asistencia menor al 85% indica riesgo de abandono; pocas evidencias indican baja participación; observaciones de conducta o salud son factores contextuales.

Devuelve EXACTAMENTE este JSON:
{ "alertas": [{ "alumno_id": string, "nivel": "bajo"|"medio"|"alto", "puntaje": number, "factores": string[], "recomendaciones": string[], "resumen": string }], "panorama": string }
El "puntaje" va de 0 a 100 (100 = riesgo máximo). Incluye a TODOS los alumnos recibidos. Las recomendaciones deben ser acciones concretas y aplicables en el aula o con la familia.`;

    return llamarGemini(prompt);
  });

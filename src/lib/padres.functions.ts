import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const consultarBoletaPadres = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ codigo: z.string().trim().min(6).max(16) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codigo = data.codigo.toUpperCase();

    const { data: alumno, error } = await supabaseAdmin
      .from("alumnos")
      .select("id, nombre_completo, grupo_id, activo")
      .eq("codigo_acceso", codigo)
      .maybeSingle();

    if (error) throw new Error("No se pudo consultar la información.");
    if (!alumno || !alumno.activo) throw new Error("Código de acceso no válido.");

    const [{ data: grupo }, { data: calificaciones }, { data: asistencias }] = await Promise.all([
      alumno.grupo_id
        ? supabaseAdmin.from("grupos").select("nombre, grado, ciclo").eq("id", alumno.grupo_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("calificaciones")
        .select("trimestre, campo_formativo, disciplina, calificacion, observaciones")
        .eq("alumno_id", alumno.id)
        .order("trimestre"),
      supabaseAdmin.from("asistencias").select("estado").eq("alumno_id", alumno.id),
    ]);

    const total = asistencias?.length ?? 0;
    const presentes = (asistencias ?? []).filter((a) => a.estado === "presente" || a.estado === "retardo").length;

    return {
      alumno: { nombre_completo: alumno.nombre_completo },
      grupo: grupo ?? null,
      calificaciones: calificaciones ?? [],
      asistencia: {
        total,
        presentes,
        porcentaje: total ? Math.round((presentes / total) * 100) : null,
      },
    };
  });

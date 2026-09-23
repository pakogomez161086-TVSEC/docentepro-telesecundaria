import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportarPDF } from "@/lib/exportar";
import { analizarRiesgo } from "@/lib/riesgo.functions";

export const Route = createFileRoute("/_authenticated/riesgo")({
  head: () => ({
    meta: [
      { title: "IA predictiva de riesgo — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Detecta con anticipación a los alumnos en riesgo de rezago o abandono y recibe recomendaciones de intervención.",
      },
      { property: "og:title", content: "IA predictiva de riesgo — DocentePRO" },
      {
        property: "og:description",
        content: "Alertas tempranas basadas en calificaciones, asistencia y evidencias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiesgoPage,
});

type Alerta = {
  alumno_id: string;
  nivel: "bajo" | "medio" | "alto";
  puntaje: number;
  factores: string[];
  recomendaciones: string[];
  resumen: string;
};

const COLOR: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  alto: "destructive",
  medio: "secondary",
  bajo: "outline",
};

function RiesgoPage() {
  const { user, perfil } = useAuth();
  const qc = useQueryClient();
  const ejecutar = useServerFn(analizarRiesgo);

  const alumnos = useQuery({
    queryKey: ["alumnos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos").select("*").order("nombre_completo");
      if (error) throw error;
      return data;
    },
  });

  const calificaciones = useQuery({
    queryKey: ["calificaciones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calificaciones").select("*");
      if (error) throw error;
      return data;
    },
  });

  const asistencias = useQuery({
    queryKey: ["asistencias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("asistencias").select("*");
      if (error) throw error;
      return data;
    },
  });

  const observaciones = useQuery({
    queryKey: ["observaciones-clase"],
    queryFn: async () => {
      const { data, error } = await supabase.from("observaciones_clase").select("*");
      if (error) throw error;
      return data;
    },
  });

  const evidencias = useQuery({
    queryKey: ["portafolio"],
    queryFn: async () => {
      const { data, error } = await supabase.from("portafolio_evidencias").select("*");
      if (error) throw error;
      return data;
    },
  });

  const alertas = useQuery({
    queryKey: ["alertas-riesgo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_riesgo")
        .select("*")
        .order("puntaje", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resumenes = useMemo(() => {
    const cal = calificaciones.data ?? [];
    const asi = asistencias.data ?? [];
    const obs = observaciones.data ?? [];
    const evi = evidencias.data ?? [];
    return (alumnos.data ?? []).map((a) => {
      const propias = cal.filter((c) => c.alumno_id === a.id);
      const promedio = propias.length
        ? Number((propias.reduce((s, c) => s + Number(c.calificacion), 0) / propias.length).toFixed(2))
        : null;
      const registros = asi.filter((x) => x.alumno_id === a.id);
      const faltas = registros.filter((x) => x.estado === "falta").length;
      const asistencia = registros.length
        ? Number((((registros.length - faltas) / registros.length) * 100).toFixed(1))
        : null;
      return {
        alumno_id: a.id,
        nombre: a.nombre_completo,
        promedio,
        reprobadas: propias.filter((c) => Number(c.calificacion) < 6).length,
        asistencia,
        faltas,
        observaciones: obs.filter((o) => o.alumno_id === a.id).length,
        evidencias: evi.filter((e) => e.alumno_id === a.id).length,
        notas: obs
          .filter((o) => o.alumno_id === a.id)
          .slice(0, 5)
          .map((o) => o.areas_mejora ?? o.observacion ?? "")
          .filter(Boolean) as string[],
      };
    });
  }, [alumnos.data, calificaciones.data, asistencias.data, observaciones.data, evidencias.data]);

  const analizar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesión no disponible");
      if (!resumenes.length) throw new Error("Primero registra alumnos y calificaciones");
      const res = (await ejecutar({ data: { alumnos: resumenes } })) as {
        alertas?: Alerta[];
        panorama?: string;
      };
      const lista = res.alertas ?? [];
      if (!lista.length) throw new Error("La IA no devolvió alertas");
      await supabase.from("alertas_riesgo").delete().eq("user_id", user.id);
      const { error } = await supabase.from("alertas_riesgo").insert(
        lista.map((a) => ({
          user_id: user.id,
          alumno_id: a.alumno_id,
          nivel: a.nivel,
          puntaje: Number(a.puntaje) || 0,
          factores: a.factores ?? [],
          recomendaciones: a.recomendaciones ?? [],
          resumen: a.resumen ?? null,
        })),
      );
      if (error) throw error;
      return lista.length;
    },
    onSuccess: (n) => {
      toast.success(`Análisis completo: ${n} alumnos evaluados`);
      void qc.invalidateQueries({ queryKey: ["alertas-riesgo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarAtendida = useMutation({
    mutationFn: async ({ id, atendida }: { id: string; atendida: boolean }) => {
      const { error } = await supabase.from("alertas_riesgo").update({ atendida }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["alertas-riesgo"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const nombreAlumno = (id: string) =>
    alumnos.data?.find((a) => a.id === id)?.nombre_completo ?? "Alumno";

  const lista = alertas.data ?? [];
  const altos = lista.filter((a) => a.nivel === "alto").length;

  function exportar() {
    if (!lista.length) {
      toast.error("No hay alertas para exportar");
      return;
    }
    exportarPDF({
      titulo: "Reporte de alerta temprana",
      subtitulo: perfil?.escuela ?? "Telesecundaria",
      metadatos: [
        { etiqueta: "Docente", valor: perfil?.nombre_completo ?? user?.email ?? "" },
        { etiqueta: "Alumnos analizados", valor: lista.length },
        { etiqueta: "Riesgo alto", valor: altos },
      ],
      secciones: [
        {
          titulo: "Alumnos y nivel de riesgo",
          tabla: {
            encabezados: ["Alumno", "Nivel", "Puntaje", "Factores", "Recomendaciones"],
            filas: lista.map((a) => [
              nombreAlumno(a.alumno_id),
              a.nivel,
              a.puntaje,
              (a.factores ?? []).join("; "),
              (a.recomendaciones ?? []).join("; "),
            ]),
          },
        },
      ],
    });
  }

  return (
    <DashboardShell
      titulo="IA predictiva de riesgo"
      subtitulo="Alerta temprana de rezago y abandono"
      acciones={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" onClick={() => analizar.mutate()} disabled={analizar.isPending}>
            {analizar.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            Analizar con IA
          </Button>
        </div>
      }
    >
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Alumnos con datos", valor: resumenes.length },
          { label: "Alertas activas", valor: lista.filter((a) => !a.atendida).length },
          { label: "Riesgo alto", valor: altos },
        ].map((k) => (
          <Card key={k.label} className="border-border/70 shadow-soft">
            <CardContent className="py-5">
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <p className="font-display text-3xl font-bold">{k.valor}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-border/70 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alertas por alumno</CardTitle>
          <CardDescription>
            El análisis combina promedio, materias reprobadas, asistencia, observaciones de clase y
            evidencias registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <p className="text-sm">Ejecuta el análisis para generar las alertas tempranas.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {lista.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-xl border p-4 ${a.atendida ? "border-border/50 opacity-70" : "border-border/70"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{nombreAlumno(a.alumno_id)}</p>
                      <Badge variant={COLOR[a.nivel] ?? "outline"} className="mt-1 capitalize">
                        Riesgo {a.nivel}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Marcar como atendida"
                      onClick={() => marcarAtendida.mutate({ id: a.id, atendida: !a.atendida })}
                    >
                      <CheckCircle2
                        className={a.atendida ? "h-4 w-4 text-primary" : "h-4 w-4"}
                      />
                    </Button>
                  </div>
                  <div className="pt-3">
                    <Progress value={Number(a.puntaje)} />
                    <p className="pt-1 text-xs text-muted-foreground">
                      Puntaje de riesgo: {Number(a.puntaje)}/100
                    </p>
                  </div>
                  {a.resumen ? <p className="pt-2 text-sm">{a.resumen}</p> : null}
                  {(a.factores ?? []).length ? (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {(a.factores ?? []).map((f, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {(a.recomendaciones ?? []).length ? (
                    <ul className="list-disc space-y-1 pl-5 pt-2 text-sm text-muted-foreground">
                      {(a.recomendaciones ?? []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

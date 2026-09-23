import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DatabaseBackup, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportarPDF } from "@/lib/exportar";

export const Route = createFileRoute("/_authenticated/respaldos")({
  head: () => ({
    meta: [
      { title: "Respaldos y exportación masiva — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Descarga un respaldo completo de tu información docente y exporta tus tablas en Excel o PDF.",
      },
      { property: "og:title", content: "Respaldos y exportación masiva — DocentePRO" },
      {
        property: "og:description",
        content: "Copia de seguridad de planeaciones, alumnos, calificaciones y evidencias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RespaldosPage,
});

const TABLAS = [
  { nombre: "grupos", etiqueta: "Grupos" },
  { nombre: "alumnos", etiqueta: "Alumnos" },
  { nombre: "calificaciones", etiqueta: "Calificaciones" },
  { nombre: "asistencias", etiqueta: "Asistencias" },
  { nombre: "proyectos_aula", etiqueta: "Proyectos de aula" },
  { nombre: "planeaciones", etiqueta: "Planeaciones" },
  { nombre: "sesiones", etiqueta: "Sesiones" },
  { nombre: "examenes", etiqueta: "Exámenes" },
  { nombre: "observaciones_clase", etiqueta: "Observaciones de clase" },
  { nombre: "expediente_notas", etiqueta: "Expedientes" },
  { nombre: "portafolio_evidencias", etiqueta: "Portafolio" },
  { nombre: "constancias", etiqueta: "Constancias" },
  { nombre: "agenda_items", etiqueta: "Agenda" },
  { nombre: "calendario_eventos", etiqueta: "Eventos del calendario" },
  { nombre: "alertas_riesgo", etiqueta: "Alertas de riesgo" },
] as const;

type Fila = Record<string, unknown>;

function descargar(nombre: string, contenido: string, tipo: string) {
  const blob = new Blob(["\ufeff", contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function aCSV(filas: Fila[]): string {
  if (!filas.length) return "";
  const cols = Object.keys(filas[0] as Fila);
  const celda = (v: unknown) =>
    `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return [cols.join(","), ...filas.map((f) => cols.map((c) => celda(f[c])).join(","))].join("\n");
}

function RespaldosPage() {
  const { user, perfil } = useAuth();
  const [cargando, setCargando] = useState<string | null>(null);

  const conteos = useQuery({
    queryKey: ["respaldo-conteos"],
    queryFn: async () => {
      const entradas = await Promise.all(
        TABLAS.map(async (t) => {
          const { count } = await supabase
            .from(t.nombre)
            .select("*", { count: "exact", head: true });
          return [t.nombre, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entradas) as Record<string, number>;
    },
  });

  async function leerTodo() {
    const datos: Record<string, Fila[]> = {};
    for (const t of TABLAS) {
      const { data, error } = await supabase.from(t.nombre).select("*");
      if (error) throw error;
      datos[t.nombre] = (data ?? []) as Fila[];
    }
    return datos;
  }

  async function respaldoCompleto() {
    setCargando("json");
    try {
      const datos = await leerTodo();
      descargar(
        `docentepro-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(
          { generado: new Date().toISOString(), docente: perfil?.nombre_completo ?? user?.email, datos },
          null,
          2,
        ),
        "application/json",
      );
      toast.success("Respaldo descargado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCargando(null);
    }
  }

  async function exportarTabla(nombre: string, etiqueta: string) {
    setCargando(nombre);
    try {
      const { data, error } = await supabase.from(nombre as (typeof TABLAS)[number]["nombre"]).select("*");
      if (error) throw error;
      const filas = (data ?? []) as Fila[];
      if (!filas.length) {
        toast.error(`No hay datos en ${etiqueta}`);
        return;
      }
      descargar(`${nombre}.csv`, aCSV(filas), "text/csv;charset=utf-8");
      toast.success(`${etiqueta} exportado para Excel`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCargando(null);
    }
  }

  function informeGeneral() {
    const c = conteos.data ?? {};
    exportarPDF({
      titulo: "Informe general del docente",
      subtitulo: perfil?.escuela ?? "Telesecundaria",
      metadatos: [
        { etiqueta: "Docente", valor: perfil?.nombre_completo ?? user?.email ?? "" },
        { etiqueta: "Fecha", valor: new Date().toLocaleDateString("es-MX") },
      ],
      secciones: [
        {
          titulo: "Resumen de información registrada",
          tabla: {
            encabezados: ["Módulo", "Registros"],
            filas: TABLAS.map((t) => [t.etiqueta, c[t.nombre] ?? 0]),
          },
        },
      ],
    });
  }

  return (
    <DashboardShell
      titulo="Respaldos y exportación"
      subtitulo="Copia de seguridad de toda tu información"
      acciones={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={informeGeneral}>
            <Download className="mr-1.5 h-4 w-4" /> Informe PDF
          </Button>
          <Button size="sm" onClick={() => void respaldoCompleto()} disabled={cargando === "json"}>
            {cargando === "json" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <DatabaseBackup className="mr-1.5 h-4 w-4" />
            )}
            Respaldo completo
          </Button>
        </div>
      }
    >
      <Card className="border-border/70 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exportación por módulo</CardTitle>
          <CardDescription>
            Descarga cada módulo en formato compatible con Excel o genera un respaldo completo para
            guardar en tu computadora.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TABLAS.map((t) => (
            <div
              key={t.nombre}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{t.etiqueta}</p>
                <Badge variant="secondary" className="mt-1">
                  {conteos.data?.[t.nombre] ?? 0} registros
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void exportarTabla(t.nombre, t.etiqueta)}
                disabled={cargando === t.nombre}
              >
                {cargando === t.nombre ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

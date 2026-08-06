import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, GraduationCap, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/analitica")({
  head: () => ({
    meta: [
      { title: "Analítica educativa — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Indicadores de aprovechamiento, asistencia y avance por campo formativo de tus grupos de Telesecundaria.",
      },
      { property: "og:title", content: "Analítica educativa — DocentePRO" },
      {
        property: "og:description",
        content: "Promedios por trimestre, asistencia y alumnos en riesgo en un solo panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnaliticaPage,
});

const COLORES = ["hsl(var(--primary))", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6"];

function AnaliticaPage() {
  const datos = useQuery({
    queryKey: ["analitica"],
    queryFn: async () => {
      const [alumnos, calificaciones, asistencias] = await Promise.all([
        supabase.from("alumnos").select("id, nombre_completo, activo"),
        supabase.from("calificaciones").select("alumno_id, trimestre, campo_formativo, calificacion"),
        supabase.from("asistencias").select("estado"),
      ]);
      if (alumnos.error) throw alumnos.error;
      if (calificaciones.error) throw calificaciones.error;
      if (asistencias.error) throw asistencias.error;
      return {
        alumnos: alumnos.data ?? [],
        calificaciones: calificaciones.data ?? [],
        asistencias: asistencias.data ?? [],
      };
    },
  });

  const alumnos = datos.data?.alumnos ?? [];
  const califs = datos.data?.calificaciones ?? [];
  const asistencias = datos.data?.asistencias ?? [];

  const promedioGeneral = califs.length
    ? califs.reduce((s, c) => s + Number(c.calificacion), 0) / califs.length
    : 0;

  const porTrimestre = [1, 2, 3].map((t) => {
    const lista = califs.filter((c) => c.trimestre === t);
    return {
      trimestre: `Trim. ${t}`,
      promedio: lista.length
        ? Number((lista.reduce((s, c) => s + Number(c.calificacion), 0) / lista.length).toFixed(1))
        : 0,
    };
  });

  const campos = Array.from(new Set(califs.map((c) => c.campo_formativo)));
  const porCampo = campos.map((campo) => {
    const lista = califs.filter((c) => c.campo_formativo === campo);
    return {
      campo,
      promedio: Number((lista.reduce((s, c) => s + Number(c.calificacion), 0) / lista.length).toFixed(1)),
    };
  });

  const promedioPorAlumno = alumnos.map((a) => {
    const lista = califs.filter((c) => c.alumno_id === a.id);
    return {
      nombre: a.nombre_completo,
      promedio: lista.length ? lista.reduce((s, c) => s + Number(c.calificacion), 0) / lista.length : null,
    };
  });
  const enRiesgo = promedioPorAlumno
    .filter((a) => a.promedio !== null && a.promedio < 6)
    .sort((a, b) => (a.promedio ?? 0) - (b.promedio ?? 0));

  const asistenciaTotal = asistencias.length;
  const presentes = asistencias.filter((a) => a.estado === "presente" || a.estado === "retardo").length;
  const porcentajeAsistencia = asistenciaTotal ? Math.round((presentes / asistenciaTotal) * 100) : 0;

  const distribucion = [
    { nombre: "Sobresaliente (9-10)", valor: promedioPorAlumno.filter((a) => (a.promedio ?? -1) >= 9).length },
    {
      nombre: "Satisfactorio (8-8.9)",
      valor: promedioPorAlumno.filter((a) => (a.promedio ?? -1) >= 8 && (a.promedio ?? 0) < 9).length,
    },
    {
      nombre: "En desarrollo (6-7.9)",
      valor: promedioPorAlumno.filter((a) => (a.promedio ?? -1) >= 6 && (a.promedio ?? 0) < 8).length,
    },
    {
      nombre: "Requiere apoyo (<6)",
      valor: promedioPorAlumno.filter((a) => a.promedio !== null && (a.promedio ?? 0) < 6).length,
    },
  ].filter((d) => d.valor > 0);

  const tarjetas = [
    { titulo: "Alumnos registrados", valor: alumnos.length, icono: Users },
    { titulo: "Promedio general", valor: promedioGeneral ? promedioGeneral.toFixed(1) : "—", icono: GraduationCap },
    { titulo: "Asistencia", valor: asistenciaTotal ? `${porcentajeAsistencia}%` : "—", icono: TrendingUp },
    { titulo: "Alumnos en riesgo", valor: enRiesgo.length, icono: BarChart3 },
  ];

  return (
    <DashboardShell titulo="Analítica educativa" subtitulo="Indicadores del grupo en tiempo real">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tarjetas.map((t) => (
          <Card key={t.titulo} className="border-border/70 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.titulo}</CardTitle>
              <t.icono className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold">{t.valor}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Promedio por trimestre</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porTrimestre}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="trimestre" fontSize={12} />
                <YAxis domain={[0, 10]} fontSize={12} />
                <Tooltip />
                <Bar dataKey="promedio" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Distribución de desempeño</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {distribucion.length === 0 ? (
              <p className="pt-10 text-center text-sm text-muted-foreground">
                Aún no hay calificaciones capturadas.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribucion} dataKey="valor" nameKey="nombre" outerRadius={80} label>
                    {distribucion.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Avance por campo formativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {porCampo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos por campo formativo.</p>
            ) : (
              porCampo.map((c) => (
                <div key={c.campo} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.campo}</span>
                    <span className="text-muted-foreground">{c.promedio}</span>
                  </div>
                  <Progress value={c.promedio * 10} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Alumnos que requieren apoyo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {enRiesgo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ningún alumno con promedio menor a 6.</p>
            ) : (
              enRiesgo.map((a) => (
                <div
                  key={a.nombre}
                  className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm"
                >
                  <span className="truncate">{a.nombre}</span>
                  <span className="font-semibold text-destructive">{a.promedio?.toFixed(1)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}

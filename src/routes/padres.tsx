import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { GraduationCap, ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { consultarBoletaPadres } from "@/lib/padres.functions";

export const Route = createFileRoute("/padres")({
  head: () => ({
    meta: [
      { title: "Portal para padres — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Consulta con tu código de acceso las calificaciones, promedio y asistencia de tu hija o hijo en Telesecundaria.",
      },
      { property: "og:title", content: "Portal para padres — DocentePRO Telesecundaria" },
      {
        property: "og:description",
        content: "Seguimiento académico de tu hija o hijo con un código de acceso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PadresPage,
});

const nivel = (p: number) =>
  p >= 9 ? "Sobresaliente" : p >= 8 ? "Satisfactorio" : p >= 6 ? "En desarrollo" : "Requiere apoyo";

function PadresPage() {
  const [codigo, setCodigo] = useState("");
  const consultar = useServerFn(consultarBoletaPadres);

  const consulta = useMutation({
    mutationFn: async (valor: string) => consultar({ data: { codigo: valor } }),
  });

  const datos = consulta.data;
  const promedio = datos?.calificaciones.length
    ? datos.calificaciones.reduce((s, c) => s + Number(c.calificacion), 0) / datos.calificaciones.length
    : null;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo size="md" />
          <h1 className="font-display text-3xl font-bold">Portal para madres, padres y tutores</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Ingresa el código de acceso que te compartió el docente para consultar el avance académico de tu
            hija o hijo.
          </p>
        </div>

        <Card className="border-border/70 shadow-soft">
          <CardContent className="pt-6">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (codigo.trim().length >= 6) consulta.mutate(codigo.trim());
              }}
            >
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="codigo">Código de acceso</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Ej. A1B2C3D4"
                  className="font-mono uppercase"
                  maxLength={16}
                />
              </div>
              <Button type="submit" disabled={consulta.isPending || codigo.trim().length < 6}>
                {consulta.isPending ? "Consultando…" : "Consultar"}
              </Button>
            </form>
            {consulta.isError ? (
              <p className="pt-3 text-sm text-destructive">
                {(consulta.error as Error).message || "No se pudo consultar la información."}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {datos ? (
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-primary" />
                {datos.alumno.nombre_completo}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {datos.grupo ? `${datos.grupo.grado}° ${datos.grupo.nombre} · Ciclo ${datos.grupo.ciclo}` : "Sin grupo asignado"}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Promedio: {promedio ? promedio.toFixed(1) : "—"}</Badge>
                {promedio ? <Badge>{nivel(promedio)}</Badge> : null}
                <Badge variant="outline">
                  Asistencia: {datos.asistencia.porcentaje !== null ? `${datos.asistencia.porcentaje}%` : "—"}
                </Badge>
              </div>

              {datos.asistencia.porcentaje !== null ? (
                <Progress value={datos.asistencia.porcentaje} />
              ) : null}

              {datos.calificaciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay calificaciones registradas para este trimestre.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trimestre</TableHead>
                      <TableHead>Campo formativo</TableHead>
                      <TableHead>Calificación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.calificaciones.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>{c.trimestre}</TableCell>
                        <TableCell className="font-medium">{c.campo_formativo}</TableCell>
                        <TableCell>{c.calificacion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Esta consulta es privada: solo muestra información del código proporcionado.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

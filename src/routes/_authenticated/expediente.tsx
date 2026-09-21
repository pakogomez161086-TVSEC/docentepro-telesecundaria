import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FolderOpen, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportarPDF } from "@/lib/exportar";

export const Route = createFileRoute("/_authenticated/expediente")({
  head: () => ({
    meta: [
      { title: "Expediente del alumno — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Concentra notas académicas, de conducta, salud y acompañamiento de cada alumno en un expediente único.",
      },
      { property: "og:title", content: "Expediente del alumno — DocentePRO" },
      {
        property: "og:description",
        content: "Historial completo por alumno con calificaciones, observaciones y evidencias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExpedientePage,
});

const TIPOS = [
  { valor: "academico", etiqueta: "Académico" },
  { valor: "conducta", etiqueta: "Conducta" },
  { valor: "salud", etiqueta: "Salud" },
  { valor: "familiar", etiqueta: "Familiar" },
  { valor: "apoyo", etiqueta: "Apoyo / canalización" },
];

const hoy = () => new Date().toISOString().slice(0, 10);

function ExpedientePage() {
  const { user, perfil } = useAuth();
  const qc = useQueryClient();
  const [alumnoId, setAlumnoId] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    fecha: hoy(),
    tipo: "academico",
    titulo: "",
    descripcion: "",
    acuerdo: "",
    confidencial: false,
  });

  const alumnos = useQuery({
    queryKey: ["alumnos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos").select("*").order("nombre_completo");
      if (error) throw error;
      return data;
    },
  });

  const alumnoActual = (alumnos.data ?? []).find((a) => a.id === alumnoId);

  const notas = useQuery({
    queryKey: ["expediente", alumnoId],
    enabled: Boolean(alumnoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expediente_notas")
        .select("*")
        .eq("alumno_id", alumnoId)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const calificaciones = useQuery({
    queryKey: ["expediente-calif", alumnoId],
    enabled: Boolean(alumnoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calificaciones")
        .select("*")
        .eq("alumno_id", alumnoId);
      if (error) throw error;
      return data;
    },
  });

  const observaciones = useQuery({
    queryKey: ["expediente-obs", alumnoId],
    enabled: Boolean(alumnoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("observaciones_clase")
        .select("*")
        .eq("alumno_id", alumnoId)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const crear = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesión no disponible");
      if (!alumnoId) throw new Error("Selecciona un alumno");
      if (!form.titulo.trim()) throw new Error("Escribe un título");
      const { error } = await supabase.from("expediente_notas").insert({
        user_id: user.id,
        alumno_id: alumnoId,
        fecha: form.fecha,
        tipo: form.tipo,
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        acuerdo: form.acuerdo || null,
        confidencial: form.confidencial,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota agregada al expediente");
      setAbierto(false);
      setForm({ fecha: hoy(), tipo: "academico", titulo: "", descripcion: "", acuerdo: "", confidencial: false });
      void qc.invalidateQueries({ queryKey: ["expediente", alumnoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expediente_notas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota eliminada");
      void qc.invalidateQueries({ queryKey: ["expediente", alumnoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promedio = (() => {
    const lista = calificaciones.data ?? [];
    if (!lista.length) return null;
    const suma = lista.reduce((acc, c) => acc + Number(c.calificacion ?? 0), 0);
    return (suma / lista.length).toFixed(1);
  })();

  function exportar() {
    if (!alumnoActual) {
      toast.error("Selecciona un alumno");
      return;
    }
    exportarPDF({
      titulo: `Expediente de ${alumnoActual.nombre_completo}`,
      subtitulo: perfil?.escuela ?? "Telesecundaria",
      metadatos: [
        { etiqueta: "Tutor", valor: alumnoActual.tutor_nombre ?? "—" },
        { etiqueta: "Promedio general", valor: promedio ?? "Sin datos" },
        { etiqueta: "Docente", valor: perfil?.nombre_completo ?? user?.email ?? "" },
      ],
      secciones: [
        {
          titulo: "Notas del expediente",
          tabla: {
            encabezados: ["Fecha", "Tipo", "Título", "Descripción", "Acuerdo"],
            filas: (notas.data ?? [])
              .filter((n) => !n.confidencial)
              .map((n) => [n.fecha, n.tipo, n.titulo, n.descripcion ?? "—", n.acuerdo ?? "—"]),
          },
        },
        {
          titulo: "Observaciones de clase",
          tabla: {
            encabezados: ["Fecha", "Campo formativo", "Observación", "Acuerdos"],
            filas: (observaciones.data ?? []).map((o) => [
              o.fecha,
              o.campo_formativo ?? "—",
              o.observacion,
              o.acuerdos ?? "—",
            ]),
          },
        },
      ],
    });
  }

  return (
    <DashboardShell
      titulo="Expediente del alumno"
      subtitulo="Historial académico y de acompañamiento"
      acciones={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!alumnoId}>
                <Plus className="mr-1.5 h-4 w-4" /> Nueva nota
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Agregar nota al expediente</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={form.fecha}
                      onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS.map((t) => (
                          <SelectItem key={t.valor} value={t.valor}>
                            {t.etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ej. Entrevista con la madre de familia"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea
                    rows={3}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Acuerdo o seguimiento</Label>
                  <Textarea
                    rows={2}
                    value={form.acuerdo}
                    onChange={(e) => setForm({ ...form, acuerdo: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                  <div>
                    <p className="text-sm font-medium">Nota confidencial</p>
                    <p className="text-xs text-muted-foreground">No se incluye en exportaciones</p>
                  </div>
                  <Switch
                    checked={form.confidencial}
                    onCheckedChange={(v) => setForm({ ...form, confidencial: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => crear.mutate()} disabled={crear.isPending}>
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <Card className="border-border/70 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selecciona un alumno</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Select value={alumnoId} onValueChange={setAlumnoId}>
            <SelectTrigger>
              <SelectValue placeholder="Alumno" />
            </SelectTrigger>
            <SelectContent>
              {(alumnos.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nombre_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="rounded-xl border border-border/70 p-3">
            <p className="text-xs text-muted-foreground">Promedio general</p>
            <p className="font-display text-2xl font-bold text-primary">{promedio ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-3">
            <p className="text-xs text-muted-foreground">Tutor</p>
            <p className="truncate text-sm font-medium">{alumnoActual?.tutor_nombre ?? "Sin registrar"}</p>
            <p className="truncate text-xs text-muted-foreground">{alumnoActual?.tutor_contacto ?? ""}</p>
          </div>
        </CardContent>
      </Card>

      {!alumnoId ? (
        <Card className="border-dashed shadow-soft">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <FolderOpen className="h-5 w-5" />
            </span>
            <p className="text-sm text-muted-foreground">
              Elige un alumno para ver su expediente completo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70 shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notas del expediente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(notas.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin notas registradas.</p>
              ) : (
                (notas.data ?? []).map((n) => (
                  <div key={n.id} className="rounded-xl border border-border/70 p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{n.fecha}</Badge>
                      <Badge variant="outline" className="capitalize">
                        {n.tipo}
                      </Badge>
                      {n.confidencial ? (
                        <Badge variant="destructive" className="gap-1">
                          <Lock className="h-3 w-3" /> Confidencial
                        </Badge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        onClick={() => eliminar.mutate(n.id)}
                        aria-label="Eliminar nota"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="pt-2 text-sm font-medium">{n.titulo}</p>
                    {n.descripcion ? (
                      <p className="text-sm text-muted-foreground">{n.descripcion}</p>
                    ) : null}
                    {n.acuerdo ? (
                      <p className="pt-1 text-xs text-muted-foreground">
                        <strong>Acuerdo:</strong> {n.acuerdo}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Observaciones de clase</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(observaciones.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin observaciones para este alumno.
                </p>
              ) : (
                (observaciones.data ?? []).map((o) => (
                  <div key={o.id} className="rounded-xl border border-border/70 p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{o.fecha}</Badge>
                      <Badge variant="outline">{o.campo_formativo ?? "General"}</Badge>
                    </div>
                    <p className="pt-2 text-sm">{o.observacion}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}

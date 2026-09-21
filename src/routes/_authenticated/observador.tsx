import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Eye, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportarPDF } from "@/lib/exportar";

export const Route = createFileRoute("/_authenticated/observador")({
  head: () => ({
    meta: [
      { title: "Observador de clase — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Registra observaciones de clase por grupo y alumno: fortalezas, áreas de mejora, acuerdos y nivel de logro.",
      },
      { property: "og:title", content: "Observador de clase — DocentePRO" },
      {
        property: "og:description",
        content: "Bitácora de observación áulica alineada a la Nueva Escuela Mexicana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ObservadorPage,
});

const CAMPOS = [
  "Lenguajes",
  "Saberes y Pensamiento Científico",
  "Ética, Naturaleza y Sociedades",
  "De lo Humano y lo Comunitario",
];

const MOMENTOS = ["inicio", "desarrollo", "cierre"];

const NIVELES: Record<number, string> = {
  1: "Requiere apoyo",
  2: "En proceso",
  3: "Satisfactorio",
  4: "Destacado",
};

const hoy = () => new Date().toISOString().slice(0, 10);

function ObservadorPage() {
  const { user, perfil } = useAuth();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");

  const [form, setForm] = useState({
    fecha: hoy(),
    grupo_id: "",
    alumno_id: "",
    campo_formativo: CAMPOS[0] as string,
    momento: "desarrollo",
    contexto: "",
    observacion: "",
    fortalezas: "",
    areas_mejora: "",
    acuerdos: "",
    nivel_logro: "3",
  });

  const grupos = useQuery({
    queryKey: ["grupos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupos").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const alumnos = useQuery({
    queryKey: ["alumnos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos").select("*").order("nombre_completo");
      if (error) throw error;
      return data;
    },
  });

  const observaciones = useQuery({
    queryKey: ["observaciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("observaciones_clase")
        .select("*")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const crear = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesión no disponible");
      if (!form.observacion.trim()) throw new Error("Describe la observación");
      const { error } = await supabase.from("observaciones_clase").insert({
        user_id: user.id,
        fecha: form.fecha,
        grupo_id: form.grupo_id || null,
        alumno_id: form.alumno_id || null,
        campo_formativo: form.campo_formativo,
        momento: form.momento,
        contexto: form.contexto || null,
        observacion: form.observacion,
        fortalezas: form.fortalezas || null,
        areas_mejora: form.areas_mejora || null,
        acuerdos: form.acuerdos || null,
        nivel_logro: Number(form.nivel_logro),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observación registrada");
      setAbierto(false);
      setForm((f) => ({ ...f, observacion: "", fortalezas: "", areas_mejora: "", acuerdos: "", contexto: "" }));
      void qc.invalidateQueries({ queryKey: ["observaciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("observaciones_clase").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observación eliminada");
      void qc.invalidateQueries({ queryKey: ["observaciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nombreAlumno = (id: string | null) =>
    alumnos.data?.find((a) => a.id === id)?.nombre_completo ?? "Grupo completo";
  const nombreGrupo = (id: string | null) => grupos.data?.find((g) => g.id === id)?.nombre ?? "Sin grupo";

  const lista = (observaciones.data ?? []).filter(
    (o) => filtroGrupo === "todos" || o.grupo_id === filtroGrupo,
  );

  const alumnosDelGrupo = (alumnos.data ?? []).filter(
    (a) => !form.grupo_id || a.grupo_id === form.grupo_id,
  );

  function exportar() {
    if (!lista.length) {
      toast.error("No hay observaciones para exportar");
      return;
    }
    exportarPDF({
      titulo: "Bitácora del observador de clase",
      subtitulo: perfil?.escuela ?? "Telesecundaria",
      metadatos: [
        { etiqueta: "Docente", valor: perfil?.nombre_completo ?? user?.email ?? "" },
        { etiqueta: "Registros", valor: lista.length },
      ],
      secciones: [
        {
          titulo: "Registros de observación",
          tabla: {
            encabezados: ["Fecha", "Grupo", "Alumno", "Momento", "Observación", "Acuerdos", "Nivel"],
            filas: lista.map((o) => [
              o.fecha,
              nombreGrupo(o.grupo_id),
              nombreAlumno(o.alumno_id),
              o.momento,
              o.observacion,
              o.acuerdos ?? "—",
              NIVELES[o.nivel_logro] ?? o.nivel_logro,
            ]),
          },
        },
      ],
    });
  }

  return (
    <DashboardShell
      titulo="Observador de clase"
      subtitulo="Bitácora de observación áulica"
      acciones={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Nueva observación
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar observación</DialogTitle>
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
                    <Label>Momento</Label>
                    <Select value={form.momento} onValueChange={(v) => setForm({ ...form, momento: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOMENTOS.map((m) => (
                          <SelectItem key={m} value={m} className="capitalize">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Grupo</Label>
                    <Select
                      value={form.grupo_id}
                      onValueChange={(v) => setForm({ ...form, grupo_id: v, alumno_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {(grupos.data ?? []).map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alumno (opcional)</Label>
                    <Select value={form.alumno_id} onValueChange={(v) => setForm({ ...form, alumno_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todo el grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {alumnosDelGrupo.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nombre_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Campo formativo</Label>
                  <Select
                    value={form.campo_formativo}
                    onValueChange={(v) => setForm({ ...form, campo_formativo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPOS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Observación</Label>
                  <Textarea
                    rows={3}
                    value={form.observacion}
                    onChange={(e) => setForm({ ...form, observacion: e.target.value })}
                    placeholder="¿Qué ocurrió durante la sesión?"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fortalezas</Label>
                  <Textarea
                    rows={2}
                    value={form.fortalezas}
                    onChange={(e) => setForm({ ...form, fortalezas: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Áreas de mejora</Label>
                  <Textarea
                    rows={2}
                    value={form.areas_mejora}
                    onChange={(e) => setForm({ ...form, areas_mejora: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Acuerdos</Label>
                  <Textarea
                    rows={2}
                    value={form.acuerdos}
                    onChange={(e) => setForm({ ...form, acuerdos: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nivel de logro</Label>
                  <Select
                    value={form.nivel_logro}
                    onValueChange={(v) => setForm({ ...form, nivel_logro: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NIVELES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base">Registros</CardTitle>
          <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los grupos</SelectItem>
              {(grupos.data ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {lista.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
                <Eye className="h-5 w-5" />
              </span>
              <p className="text-sm">Aún no registras observaciones de clase.</p>
            </div>
          ) : (
            lista.map((o) => (
              <div key={o.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{o.fecha}</Badge>
                  <Badge variant="outline">{nombreGrupo(o.grupo_id)}</Badge>
                  <Badge variant="outline">{nombreAlumno(o.alumno_id)}</Badge>
                  <Badge className="capitalize">{o.momento}</Badge>
                  <Badge variant={o.nivel_logro <= 2 ? "destructive" : "default"}>
                    {NIVELES[o.nivel_logro]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={() => eliminar.mutate(o.id)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="pt-2 text-sm">{o.observacion}</p>
                <div className="grid gap-2 pt-2 text-xs text-muted-foreground sm:grid-cols-3">
                  {o.fortalezas ? <p><strong>Fortalezas:</strong> {o.fortalezas}</p> : null}
                  {o.areas_mejora ? <p><strong>Áreas de mejora:</strong> {o.areas_mejora}</p> : null}
                  {o.acuerdos ? <p><strong>Acuerdos:</strong> {o.acuerdos}</p> : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

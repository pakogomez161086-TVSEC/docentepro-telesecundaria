import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, ExternalLink, Images, Plus, Star, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/portafolio")({
  head: () => ({
    meta: [
      { title: "Portafolio de evidencias — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Organiza productos, proyectos y evidencias de aprendizaje por alumno, trimestre y campo formativo.",
      },
      { property: "og:title", content: "Portafolio de evidencias — DocentePRO" },
      {
        property: "og:description",
        content: "Evidencias de aprendizaje listas para la evaluación formativa de la NEM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortafolioPage,
});

const CAMPOS = [
  "Lenguajes",
  "Saberes y Pensamiento Científico",
  "Ética, Naturaleza y Sociedades",
  "De lo Humano y lo Comunitario",
];

const TIPOS = ["producto", "proyecto", "examen", "exposición", "fotografía", "otro"];

const hoy = () => new Date().toISOString().slice(0, 10);

function PortafolioPage() {
  const { user, perfil } = useAuth();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [filtroAlumno, setFiltroAlumno] = useState("todos");
  const [filtroTrimestre, setFiltroTrimestre] = useState("todos");
  const [form, setForm] = useState({
    fecha: hoy(),
    alumno_id: "",
    grupo_id: "",
    titulo: "",
    descripcion: "",
    campo_formativo: CAMPOS[0] as string,
    tipo: "producto",
    url: "",
    trimestre: "1",
    destacada: false,
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

  const evidencias = useQuery({
    queryKey: ["portafolio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portafolio_evidencias")
        .select("*")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const crear = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesión no disponible");
      if (!form.titulo.trim()) throw new Error("Escribe un título para la evidencia");
      const { error } = await supabase.from("portafolio_evidencias").insert({
        user_id: user.id,
        alumno_id: form.alumno_id || null,
        grupo_id: form.grupo_id || null,
        fecha: form.fecha,
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        campo_formativo: form.campo_formativo,
        tipo: form.tipo,
        url: form.url || null,
        trimestre: Number(form.trimestre),
        destacada: form.destacada,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evidencia agregada");
      setAbierto(false);
      setForm((f) => ({ ...f, titulo: "", descripcion: "", url: "", destacada: false }));
      void qc.invalidateQueries({ queryKey: ["portafolio"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarDestacada = useMutation({
    mutationFn: async ({ id, destacada }: { id: string; destacada: boolean }) => {
      const { error } = await supabase
        .from("portafolio_evidencias")
        .update({ destacada })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["portafolio"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portafolio_evidencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evidencia eliminada");
      void qc.invalidateQueries({ queryKey: ["portafolio"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nombreAlumno = (id: string | null) =>
    alumnos.data?.find((a) => a.id === id)?.nombre_completo ?? "Grupo completo";

  const lista = (evidencias.data ?? []).filter(
    (e) =>
      (filtroAlumno === "todos" || e.alumno_id === filtroAlumno) &&
      (filtroTrimestre === "todos" || String(e.trimestre) === filtroTrimestre),
  );

  function exportar() {
    if (!lista.length) {
      toast.error("No hay evidencias para exportar");
      return;
    }
    exportarPDF({
      titulo: "Portafolio de evidencias",
      subtitulo: perfil?.escuela ?? "Telesecundaria",
      metadatos: [
        { etiqueta: "Docente", valor: perfil?.nombre_completo ?? user?.email ?? "" },
        { etiqueta: "Evidencias", valor: lista.length },
      ],
      secciones: [
        {
          titulo: "Evidencias registradas",
          tabla: {
            encabezados: ["Fecha", "Alumno", "Trimestre", "Campo formativo", "Tipo", "Evidencia"],
            filas: lista.map((e) => [
              e.fecha,
              nombreAlumno(e.alumno_id),
              e.trimestre,
              e.campo_formativo ?? "—",
              e.tipo,
              `${e.titulo}${e.descripcion ? ` — ${e.descripcion}` : ""}`,
            ]),
          },
        },
      ],
    });
  }

  return (
    <DashboardShell
      titulo="Portafolio de evidencias"
      subtitulo="Productos y evidencias de aprendizaje"
      acciones={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Nueva evidencia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar evidencia</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ej. Maqueta del ciclo del agua"
                  />
                </div>
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
                    <Label>Trimestre</Label>
                    <Select
                      value={form.trimestre}
                      onValueChange={(v) => setForm({ ...form, trimestre: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3"].map((t) => (
                          <SelectItem key={t} value={t}>
                            Trimestre {t}
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
                        {(alumnos.data ?? [])
                          .filter((a) => !form.grupo_id || a.grupo_id === form.grupo_id)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.nombre_completo}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                  <Label>Enlace (opcional)</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                  <p className="text-sm font-medium">Marcar como destacada</p>
                  <Switch
                    checked={form.destacada}
                    onCheckedChange={(v) => setForm({ ...form, destacada: v })}
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
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base">Evidencias ({lista.length})</CardTitle>
          <div className="flex gap-2">
            <Select value={filtroAlumno} onValueChange={setFiltroAlumno}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los alumnos</SelectItem>
                {(alumnos.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroTrimestre} onValueChange={setFiltroTrimestre}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {["1", "2", "3"].map((t) => (
                  <SelectItem key={t} value={t}>
                    Trimestre {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
                <Images className="h-5 w-5" />
              </span>
              <p className="text-sm">Aún no hay evidencias en el portafolio.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((e) => (
                <div key={e.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 font-medium">{e.titulo}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => alternarDestacada.mutate({ id: e.id, destacada: !e.destacada })}
                      aria-label="Destacar"
                    >
                      <Star className={e.destacada ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminar.mutate(e.id)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <Badge variant="secondary">T{e.trimestre}</Badge>
                    <Badge variant="outline" className="capitalize">
                      {e.tipo}
                    </Badge>
                    <Badge variant="outline">{nombreAlumno(e.alumno_id)}</Badge>
                  </div>
                  {e.descripcion ? (
                    <p className="pt-2 text-sm text-muted-foreground">{e.descripcion}</p>
                  ) : null}
                  <p className="pt-2 text-xs text-muted-foreground">{e.campo_formativo}</p>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 pt-2 text-xs font-medium text-primary hover:underline"
                    >
                      Ver evidencia <ExternalLink className="h-3 w-3" />
                    </a>
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

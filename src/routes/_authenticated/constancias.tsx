import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileSignature, Plus, Printer, Trash2 } from "lucide-react";
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
import { exportarPDF, exportarWord } from "@/lib/exportar";

export const Route = createFileRoute("/_authenticated/constancias")({
  head: () => ({
    meta: [
      { title: "Constancias y documentos oficiales — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Genera constancias de estudios, buena conducta, reconocimientos y citatorios con folio y formato oficial.",
      },
      { property: "og:title", content: "Constancias y documentos oficiales — DocentePRO" },
      {
        property: "og:description",
        content: "Documentos escolares con folio, listos para imprimir o descargar en Word.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConstanciasPage,
});

const TIPOS: { valor: string; etiqueta: string }[] = [
  { valor: "estudios", etiqueta: "Constancia de estudios" },
  { valor: "conducta", etiqueta: "Constancia de buena conducta" },
  { valor: "inscripcion", etiqueta: "Constancia de inscripción" },
  { valor: "reconocimiento", etiqueta: "Reconocimiento al desempeño" },
  { valor: "citatorio", etiqueta: "Citatorio a padre o tutor" },
  { valor: "carta", etiqueta: "Carta compromiso" },
];

const hoy = () => new Date().toISOString().slice(0, 10);

const nuevoFolio = () =>
  `DP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

const plantilla = (tipo: string, alumno: string, escuela: string) => {
  const base = `Por medio de la presente se hace constar que`;
  switch (tipo) {
    case "conducta":
      return `${base} el/la alumno(a) ${alumno} ha observado buena conducta y ha mostrado respeto a la comunidad escolar de ${escuela} durante el ciclo escolar 2026–2027.`;
    case "inscripcion":
      return `${base} el/la alumno(a) ${alumno} se encuentra debidamente inscrito(a) en ${escuela} para el ciclo escolar 2026–2027.`;
    case "reconocimiento":
      return `Se otorga el presente reconocimiento a ${alumno} por su destacado desempeño académico y su compromiso con los proyectos comunitarios de la Nueva Escuela Mexicana.`;
    case "citatorio":
      return `Se cita al padre, madre o tutor de ${alumno} a una reunión en ${escuela} para tratar asuntos relacionados con el desempeño escolar del alumno(a).`;
    case "carta":
      return `El/la alumno(a) ${alumno}, junto con su familia, se compromete a cumplir con los acuerdos de convivencia y desempeño establecidos con ${escuela}.`;
    default:
      return `${base} el/la alumno(a) ${alumno} cursa sus estudios de educación secundaria en ${escuela}, modalidad Telesecundaria, durante el ciclo escolar 2026–2027.`;
  }
};

function ConstanciasPage() {
  const { user, perfil } = useAuth();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    tipo: "estudios",
    alumno_id: "",
    folio: nuevoFolio(),
    fecha: hoy(),
    destinatario: "A quien corresponda",
    cuerpo: "",
    observaciones: "",
  });

  const alumnos = useQuery({
    queryKey: ["alumnos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos").select("*").order("nombre_completo");
      if (error) throw error;
      return data;
    },
  });

  const constancias = useQuery({
    queryKey: ["constancias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("constancias")
        .select("*")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const escuela = perfil?.escuela ?? "la Telesecundaria";
  const nombreAlumno = (id: string | null) =>
    alumnos.data?.find((a) => a.id === id)?.nombre_completo ?? "—";

  const crear = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesión no disponible");
      if (!form.alumno_id) throw new Error("Selecciona un alumno");
      const cuerpo =
        form.cuerpo.trim() || plantilla(form.tipo, nombreAlumno(form.alumno_id), escuela);
      const { error } = await supabase.from("constancias").insert({
        user_id: user.id,
        alumno_id: form.alumno_id,
        tipo: form.tipo,
        folio: form.folio,
        fecha: form.fecha,
        destinatario: form.destinatario || null,
        cuerpo,
        observaciones: form.observaciones || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento generado");
      setAbierto(false);
      setForm((f) => ({ ...f, folio: nuevoFolio(), cuerpo: "", observaciones: "" }));
      void qc.invalidateQueries({ queryKey: ["constancias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("constancias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento eliminado");
      void qc.invalidateQueries({ queryKey: ["constancias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const documento = (c: NonNullable<typeof constancias.data>[number]) => ({
    titulo: TIPOS.find((t) => t.valor === c.tipo)?.etiqueta ?? "Documento oficial",
    subtitulo: escuela,
    metadatos: [
      { etiqueta: "Folio", valor: c.folio },
      { etiqueta: "Fecha", valor: c.fecha },
      { etiqueta: "Alumno", valor: nombreAlumno(c.alumno_id) },
    ],
    secciones: [
      { titulo: c.destinatario || "A quien corresponda", parrafos: [c.cuerpo] },
      ...(c.observaciones ? [{ titulo: "Observaciones", parrafos: [c.observaciones] }] : []),
      {
        titulo: "Firma",
        parrafos: [
          "\n\n___________________________________",
          perfil?.nombre_completo ?? user?.email ?? "Docente responsable",
          "Docente frente a grupo",
        ],
      },
    ],
  });

  const lista = constancias.data ?? [];

  return (
    <DashboardShell
      titulo="Constancias y documentos"
      subtitulo="Documentos oficiales con folio"
      acciones={
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Generar documento oficial</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de documento</Label>
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
              <div className="space-y-1.5">
                <Label>Alumno</Label>
                <Select
                  value={form.alumno_id}
                  onValueChange={(v) => setForm({ ...form, alumno_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {(alumnos.data ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nombre_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Folio</Label>
                  <Input
                    value={form.folio}
                    onChange={(e) => setForm({ ...form, folio: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Dirigido a</Label>
                <Input
                  value={form.destinatario}
                  onChange={(e) => setForm({ ...form, destinatario: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Texto del documento</Label>
                <Textarea
                  rows={5}
                  value={form.cuerpo}
                  onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
                  placeholder="Déjalo vacío para usar el texto sugerido según el tipo de documento."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      cuerpo: plantilla(f.tipo, nombreAlumno(f.alumno_id), escuela),
                    }))
                  }
                >
                  Usar texto sugerido
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Observaciones (opcional)</Label>
                <Textarea
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => crear.mutate()} disabled={crear.isPending}>
                Guardar documento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Card className="border-border/70 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Documentos emitidos ({lista.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
                <FileSignature className="h-5 w-5" />
              </span>
              <p className="text-sm">Aún no has emitido documentos oficiales.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {lista.map((c) => (
                <div key={c.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {TIPOS.find((t) => t.valor === c.tipo)?.etiqueta ?? c.tipo}
                      </p>
                      <p className="text-sm text-muted-foreground">{nombreAlumno(c.alumno_id)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminar.mutate(c.id)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <Badge variant="secondary">Folio {c.folio}</Badge>
                    <Badge variant="outline">{c.fecha}</Badge>
                  </div>
                  <p className="pt-2 text-sm text-muted-foreground line-clamp-3">{c.cuerpo}</p>
                  <div className="flex gap-2 pt-3">
                    <Button size="sm" variant="outline" onClick={() => exportarPDF(documento(c))}>
                      <Printer className="mr-1.5 h-4 w-4" /> Imprimir
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => exportarWord(documento(c))}>
                      Word
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

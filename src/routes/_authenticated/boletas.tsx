import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Download, Plus, Users } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportarPDF } from "@/lib/exportar";

export const Route = createFileRoute("/_authenticated/boletas")({
  head: () => ({
    meta: [
      { title: "Boletas y evaluación — DocentePRO Telesecundaria" },
      {
        name: "description",
        content:
          "Registra grupos, alumnos y calificaciones por campo formativo y genera boletas imprimibles de la NEM.",
      },
      { property: "og:title", content: "Boletas y evaluación — DocentePRO" },
      { property: "og:description", content: "Captura de calificaciones y boletas listas para imprimir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoletasPage,
});

const CAMPOS = [
  "Lenguajes",
  "Saberes y Pensamiento Científico",
  "Ética, Naturaleza y Sociedades",
  "De lo Humano y lo Comunitario",
];

const nivel = (p: number) =>
  p >= 9 ? "Sobresaliente" : p >= 8 ? "Satisfactorio" : p >= 6 ? "En desarrollo" : "Requiere apoyo";

function BoletasPage() {
  const { user, perfil } = useAuth();
  const qc = useQueryClient();
  const [grupoNombre, setGrupoNombre] = useState("");
  const [grupoGrado, setGrupoGrado] = useState("1");
  const [alumnoNombre, setAlumnoNombre] = useState("");
  const [alumnoGrupo, setAlumnoGrupo] = useState<string>("");
  const [alumnoTutor, setAlumnoTutor] = useState("");
  const [trimestre, setTrimestre] = useState("1");
  const [seleccion, setSeleccion] = useState<string>("");

  const grupos = useQuery({
    queryKey: ["grupos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupos").select("*").order("created_at");
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

  const calificaciones = useQuery({
    queryKey: ["calificaciones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calificaciones").select("*");
      if (error) throw error;
      return data;
    },
  });

  const crearGrupo = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesión no válida.");
      const { error } = await supabase.from("grupos").insert({
        user_id: user.id,
        nombre: grupoNombre.trim(),
        grado: Number(grupoGrado),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setGrupoNombre("");
      toast.success("Grupo creado");
      void qc.invalidateQueries({ queryKey: ["grupos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const crearAlumno = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesión no válida.");
      const { error } = await supabase.from("alumnos").insert({
        user_id: user.id,
        nombre_completo: alumnoNombre.trim(),
        grupo_id: alumnoGrupo || null,
        tutor_nombre: alumnoTutor.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAlumnoNombre("");
      setAlumnoTutor("");
      toast.success("Alumno registrado");
      void qc.invalidateQueries({ queryKey: ["alumnos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const guardarCalificacion = useMutation({
    mutationFn: async (args: { alumnoId: string; campo: string; valor: number }) => {
      if (!user) throw new Error("Sesión no válida.");
      const { error } = await supabase.from("calificaciones").upsert(
        {
          user_id: user.id,
          alumno_id: args.alumnoId,
          trimestre: Number(trimestre),
          campo_formativo: args.campo,
          disciplina: null,
          calificacion: args.valor,
        },
        { onConflict: "alumno_id,trimestre,campo_formativo,disciplina" },
      );
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["calificaciones"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const listaAlumnos = alumnos.data ?? [];
  const califs = calificaciones.data ?? [];

  const valorDe = (alumnoId: string, campo: string) =>
    califs.find(
      (c) => c.alumno_id === alumnoId && c.campo_formativo === campo && c.trimestre === Number(trimestre),
    )?.calificacion ?? "";

  const promedioDe = (alumnoId: string, tri?: number) => {
    const lista = califs.filter((c) => c.alumno_id === alumnoId && (tri ? c.trimestre === tri : true));
    if (!lista.length) return null;
    return lista.reduce((s, c) => s + Number(c.calificacion), 0) / lista.length;
  };

  const alumnoSeleccionado = listaAlumnos.find((a) => a.id === seleccion) ?? null;

  function descargarBoleta(alumnoId: string) {
    const alumno = listaAlumnos.find((a) => a.id === alumnoId);
    if (!alumno) return;
    const grupo = (grupos.data ?? []).find((g) => g.id === alumno.grupo_id);
    const filas = CAMPOS.map((campo) => [
      campo,
      ...[1, 2, 3].map(
        (t) =>
          califs.find(
            (c) => c.alumno_id === alumnoId && c.campo_formativo === campo && c.trimestre === t,
          )?.calificacion ?? "—",
      ),
    ]);
    const prom = promedioDe(alumnoId);
    exportarPDF({
      titulo: "Boleta de evaluación",
      subtitulo: alumno.nombre_completo,
      metadatos: [
        { etiqueta: "Grupo", valor: grupo ? `${grupo.grado}° ${grupo.nombre}` : "Sin grupo" },
        { etiqueta: "Ciclo escolar", valor: grupo?.ciclo ?? "2026-2027" },
        { etiqueta: "Escuela", valor: perfil?.escuela ?? "—" },
        { etiqueta: "Docente", valor: perfil?.nombre_completo ?? "—" },
      ],
      secciones: [
        {
          titulo: "Calificaciones por campo formativo",
          tabla: { encabezados: ["Campo formativo", "Trim. 1", "Trim. 2", "Trim. 3"], filas },
        },
        {
          titulo: "Resultado global",
          parrafos: [
            prom ? `Promedio general: ${prom.toFixed(1)}` : "Sin calificaciones capturadas.",
            prom ? `Nivel de desempeño: ${nivel(prom)}` : null,
          ],
        },
      ],
    });
  }

  return (
    <DashboardShell titulo="Boletas y evaluación" subtitulo="Grupos, alumnos y calificaciones">
      <Tabs defaultValue="captura" className="space-y-4">
        <TabsList>
          <TabsTrigger value="captura">Captura</TabsTrigger>
          <TabsTrigger value="boletas">Boletas</TabsTrigger>
          <TabsTrigger value="grupos">Grupos y alumnos</TabsTrigger>
        </TabsList>

        <TabsContent value="captura" className="space-y-4">
          <Card className="border-border/70 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Calificaciones por campo formativo</CardTitle>
              <Select value={trimestre} onValueChange={setTrimestre}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      Trimestre {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {listaAlumnos.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Registra alumnos en la pestaña «Grupos y alumnos».
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-48">Alumno</TableHead>
                      {CAMPOS.map((c) => (
                        <TableHead key={c} className="min-w-40 text-xs">
                          {c}
                        </TableHead>
                      ))}
                      <TableHead>Promedio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaAlumnos.map((a) => {
                      const prom = promedioDe(a.id, Number(trimestre));
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.nombre_completo}</TableCell>
                          {CAMPOS.map((campo) => (
                            <TableCell key={campo}>
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                step="0.1"
                                className="h-9 w-20"
                                defaultValue={String(valorDe(a.id, campo))}
                                onBlur={(e) => {
                                  const valor = Number(e.target.value);
                                  if (!e.target.value || Number.isNaN(valor)) return;
                                  if (valor < 0 || valor > 10) {
                                    toast.error("La calificación debe estar entre 0 y 10.");
                                    return;
                                  }
                                  guardarCalificacion.mutate({ alumnoId: a.id, campo, valor });
                                }}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="font-semibold">{prom ? prom.toFixed(1) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boletas" className="space-y-4">
          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Generar boleta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={seleccion} onValueChange={setSeleccion}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Selecciona un alumno" />
                </SelectTrigger>
                <SelectContent>
                  {listaAlumnos.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {alumnoSeleccionado ? (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campo formativo</TableHead>
                        {[1, 2, 3].map((t) => (
                          <TableHead key={t}>Trim. {t}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {CAMPOS.map((campo) => (
                        <TableRow key={campo}>
                          <TableCell className="font-medium">{campo}</TableCell>
                          {[1, 2, 3].map((t) => (
                            <TableCell key={t}>
                              {califs.find(
                                (c) =>
                                  c.alumno_id === alumnoSeleccionado.id &&
                                  c.campo_formativo === campo &&
                                  c.trimestre === t,
                              )?.calificacion ?? "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary">
                      Promedio: {promedioDe(alumnoSeleccionado.id)?.toFixed(1) ?? "—"}
                    </Badge>
                    <Button onClick={() => descargarBoleta(alumnoSeleccionado.id)}>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar boleta
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grupos" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo grupo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo grupo</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="grupo">Nombre del grupo</Label>
                    <Input
                      id="grupo"
                      value={grupoNombre}
                      onChange={(e) => setGrupoNombre(e.target.value)}
                      placeholder="A"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Grado</Label>
                    <Select value={grupoGrado} onValueChange={setGrupoGrado}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3].map((g) => (
                          <SelectItem key={g} value={String(g)}>
                            {g}°
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => crearGrupo.mutate()}
                    disabled={!grupoNombre.trim() || crearGrupo.isPending}
                  >
                    Guardar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo alumno
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo alumno</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="alumno">Nombre completo</Label>
                    <Input
                      id="alumno"
                      value={alumnoNombre}
                      onChange={(e) => setAlumnoNombre(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Grupo</Label>
                    <Select value={alumnoGrupo} onValueChange={setAlumnoGrupo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(grupos.data ?? []).map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.grado}° {g.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tutor">Madre, padre o tutor</Label>
                    <Input id="tutor" value={alumnoTutor} onChange={(e) => setAlumnoTutor(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => crearAlumno.mutate()}
                    disabled={!alumnoNombre.trim() || crearAlumno.isPending}
                  >
                    Guardar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-border/70 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Alumnos y códigos para padres</CardTitle>
            </CardHeader>
            <CardContent>
              {listaAlumnos.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <Users className="h-6 w-6 text-primary" />
                  Todavía no registras alumnos.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Código de acceso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaAlumnos.map((a) => {
                      const g = (grupos.data ?? []).find((x) => x.id === a.grupo_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.nombre_completo}</TableCell>
                          <TableCell>{g ? `${g.grado}° ${g.nombre}` : "—"}</TableCell>
                          <TableCell>{a.tutor_nombre ?? "—"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-mono"
                              onClick={() => {
                                void navigator.clipboard.writeText(a.codigo_acceso);
                                toast.success("Código copiado");
                              }}
                            >
                              {a.codigo_acceso}
                              <Copy className="ml-2 h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BellRing, CalendarRange, Check, Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario inteligente 2026–2027 — DocentePRO" },
      {
        name: "description",
        content:
          "Combina el calendario oficial con tus actividades, entregas y evaluaciones, con alertas de lo próximo.",
      },
      { property: "og:title", content: "Calendario inteligente — DocentePRO" },
      { property: "og:description", content: "Fechas oficiales y actividades del docente en un solo lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarioPage,
});

const TIPOS = ["actividad", "evaluacion", "entrega", "reunion", "proyecto", "otro"];

const COLOR: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  suspension: "destructive",
  cte: "secondary",
  evaluacion: "default",
  entrega: "default",
  reunion: "secondary",
};

type Item = {
  id: string;
  fecha: string;
  titulo: string;
  tipo: string;
  descripcion: string | null;
  propio: boolean;
  completado?: boolean;
  recordatorio?: boolean;
};

const hoy = () => new Date().toISOString().slice(0, 10);

function CalendarioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState({
    fecha: hoy(),
    titulo: "",
    tipo: "actividad",
    descripcion: "",
    grupo_id: "",
    recordatorio: true,
  });

  const oficial = useQuery({
    queryKey: ["calendario-escolar"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendario_escolar").select("*").order("fecha");
      if (error) throw error;
      return data;
    },
  });

  const propios = useQuery({
    queryKey: ["calendario-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendario_eventos").select("*").order("fecha");
      if (error) throw error;
      return data;
    },
  });

  const grupos = useQuery({
    queryKey: ["grupos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grupos").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const crear = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesión no disponible");
      if (!form.titulo.trim()) throw new Error("Escribe un título");
      const choque = (oficial.data ?? []).find(
        (e) => e.fecha === form.fecha && e.tipo === "suspension",
      );
      const { error } = await supabase.from("calendario_eventos").insert({
        user_id: user.id,
        fecha: form.fecha,
        titulo: form.titulo,
        tipo: form.tipo,
        descripcion: form.descripcion || null,
        grupo_id: form.grupo_id || null,
        recordatorio: form.recordatorio,
      });
      if (error) throw error;
      return choque?.titulo;
    },
    onSuccess: (choque) => {
      if (choque) toast.warning(`Ojo: esa fecha hay suspensión (${choque})`);
      else toast.success("Evento agregado");
      setAbierto(false);
      setForm((f) => ({ ...f, titulo: "", descripcion: "" }));
      void qc.invalidateQueries({ queryKey: ["calendario-eventos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, completado }: { id: string; completado: boolean }) => {
      const { error } = await supabase.from("calendario_eventos").update({ completado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["calendario-eventos"] }),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendario_eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["calendario-eventos"] }),
  });

  const items: Item[] = useMemo(() => {
    const a: Item[] = (oficial.data ?? []).map((e) => ({
      id: e.id,
      fecha: e.fecha,
      titulo: e.titulo,
      tipo: e.tipo,
      descripcion: e.descripcion,
      propio: false,
    }));
    const b: Item[] = (propios.data ?? []).map((e) => ({
      id: e.id,
      fecha: e.fecha,
      titulo: e.titulo,
      tipo: e.tipo,
      descripcion: e.descripcion,
      propio: true,
      completado: e.completado,
      recordatorio: e.recordatorio,
    }));
    return [...a, ...b]
      .filter((i) => filtro === "todos" || (filtro === "mios" ? i.propio : !i.propio))
      .sort((x, y) => x.fecha.localeCompare(y.fecha));
  }, [oficial.data, propios.data, filtro]);

  const proximos = useMemo(() => {
    const h = hoy();
    const limite = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    return items.filter((i) => i.fecha >= h && i.fecha <= limite && !i.completado);
  }, [items]);

  const meses = items.reduce<Record<string, Item[]>>((acc, ev) => {
    const key = new Date(`${ev.fecha}T12:00:00`).toLocaleDateString("es-MX", {
      month: "long",
      year: "numeric",
    });
    acc[key] = [...(acc[key] ?? []), ev];
    return acc;
  }, {});

  return (
    <DashboardShell
      titulo="Calendario inteligente"
      subtitulo="Ciclo 2026–2027 · fechas oficiales y tus actividades"
      acciones={
        <div className="flex items-center gap-2">
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo</SelectItem>
              <SelectItem value="oficial">Solo oficial</SelectItem>
              <SelectItem value="mios">Mis eventos</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Nuevo evento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Agregar evento</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fecha</Label>
                    <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
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
                  <Label>Grupo (opcional)</Label>
                  <Select value={form.grupo_id} onValueChange={(v) => setForm({ ...form, grupo_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
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
                  <Label>Descripción</Label>
                  <Textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                  <p className="text-sm font-medium">Mostrar en próximos recordatorios</p>
                  <Switch checked={form.recordatorio} onCheckedChange={(v) => setForm({ ...form, recordatorio: v })} />
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
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" /> Próximos 14 días
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pendientes en las próximas dos semanas.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {proximos.map((p) => (
                <Badge key={p.id} variant={COLOR[p.tipo] ?? "outline"}>
                  {p.fecha.slice(5)} · {p.titulo}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(meses).length === 0 ? (
        <Card className="border-dashed shadow-soft">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <CalendarRange className="h-5 w-5" />
            </span>
            <p className="font-semibold">Sin fechas registradas</p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(meses).map(([mes, lista]) => (
            <Card key={mes} className="border-border/70 shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-base capitalize">{mes}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lista.map((ev) => (
                  <div key={ev.id} className={`flex items-start gap-3 text-sm ${ev.completado ? "opacity-60" : ""}`}>
                    <span className="mt-0.5 w-10 shrink-0 text-center font-display text-lg font-bold text-primary">
                      {ev.fecha.slice(-2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${ev.completado ? "line-through" : ""}`}>{ev.titulo}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant={COLOR[ev.tipo] ?? "outline"} className="capitalize">
                          {ev.tipo}
                        </Badge>
                        {ev.propio ? <Badge variant="outline">Mío</Badge> : null}
                      </div>
                      {ev.descripcion ? <p className="pt-1 text-xs text-muted-foreground">{ev.descripcion}</p> : null}
                    </div>
                    {ev.propio ? (
                      <div className="flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Completar"
                          onClick={() => actualizar.mutate({ id: ev.id, completado: !ev.completado })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => eliminar.mutate(ev.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </DashboardShell>
  );
}

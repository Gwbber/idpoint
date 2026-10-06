import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock3, FilePenLine, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmployees } from "@/hooks/useAttendance";
import { completePointAdjustment, getResponsibleAdmin, rejectPointAdjustment } from "@/lib/adjustments.functions";
import type { PointAdjustmentRequest } from "@/lib/attendance";
import { formatDate, formatDateTime, formatTime, localTimeToISO, todayISO } from "@/lib/time-utils";
import { logAudit } from "@/lib/audit";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({ meta: [
    { title: "Ajustes de ponto — ID Point" },
    { name: "description", content: "Solicite, acompanhe e analise correções de registros de ponto." },
    { property: "og:title", content: "Ajustes de ponto — ID Point" },
    { property: "og:description", content: "Solicitações e análises de correções de ponto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AjustesPage,
});

type Times = { clockIn: string; lunchStart: string; lunchEnd: string; clockOut: string };
const emptyTimes: Times = { clockIn: "08:00", lunchStart: "12:00", lunchEnd: "13:00", clockOut: "17:48" };
const statusLabel: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado" };

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="outline" className="border-success text-success">Aprovado</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Recusado</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

function TimeFields({ value, onChange }: { value: Times; onChange: (value: Times) => void }) {
  const fields: Array<[keyof Times, string]> = [["clockIn", "Entrada"], ["lunchStart", "Início do intervalo"], ["lunchEnd", "Fim do intervalo"], ["clockOut", "Saída"]];
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {fields.map(([key, label]) => <div key={key} className="space-y-1.5"><Label htmlFor={key}>{label}</Label><Input id={key} type="time" className="text-clock" value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} required /></div>)}
  </div>;
}

function requestedTimes(request: PointAdjustmentRequest): Times {
  return {
    clockIn: formatTime(request.requested_clock_in),
    lunchStart: formatTime(request.requested_lunch_start),
    lunchEnd: formatTime(request.requested_lunch_end),
    clockOut: formatTime(request.requested_clock_out),
  };
}

function validateTimes(times: Times) {
  return times.clockIn < times.lunchStart && times.lunchStart < times.lunchEnd && times.lunchEnd < times.clockOut;
}

function AjustesPage() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const responsibleFn = useServerFn(getResponsibleAdmin);
  const completeAdjustment = useServerFn(completePointAdjustment);
  const rejectAdjustment = useServerFn(rejectPointAdjustment);
  const employees = useEmployees();
  const [date, setDate] = useState(todayISO());
  const [times, setTimes] = useState<Times>(emptyTimes);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState<PointAdjustmentRequest | null>(null);
  const [reviewTimes, setReviewTimes] = useState<Times>(emptyTimes);
  const [reviewNotes, setReviewNotes] = useState("");

  const responsible = useQuery({ queryKey: ["responsible-admin", user?.id], enabled: Boolean(user) && !isAdmin, queryFn: () => responsibleFn() });
  const requests = useQuery({
    queryKey: ["point-adjustment-requests", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("point_adjustment_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PointAdjustmentRequest[];
    },
  });

  const names = new Map((employees.data ?? []).map((employee) => [employee.id, employee.full_name]));
  if (profile) names.set(profile.id, profile.full_name);

  async function requestAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !responsible.data) return;
    if (!validateTimes(times)) { toast.error("Os horários devem estar em ordem: entrada, intervalo e saída."); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("point_adjustment_requests").insert({
        employee_id: user.id,
        assigned_admin_id: responsible.data.id,
        work_date: date,
        requested_clock_in: localTimeToISO(date, times.clockIn),
        requested_lunch_start: localTimeToISO(date, times.lunchStart),
        requested_lunch_end: localTimeToISO(date, times.lunchEnd),
        requested_clock_out: localTimeToISO(date, times.clockOut),
      }).select("id").single();
      if (error) throw error;
      await logAudit({ actorId: user.id, actorName: profile?.full_name ?? "", action: "adjustment_requested", entity: "point_adjustment_request", entityId: data.id, details: { date, responsible: responsible.data.full_name } });
      toast.success("Solicitação enviada ao administrador responsável.");
      await queryClient.invalidateQueries({ queryKey: ["point-adjustment-requests"] });
    } catch (error) {
      const message = error instanceof Error ? error.message :
        typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
          ? error.message : "Não foi possível enviar a solicitação.";
      console.error("Falha ao enviar solicitação de ajuste:", error);
      toast.error(message.includes("duplicate") ? "Já existe uma solicitação pendente para esta data." :
        message.includes("row-level security") ? "Não foi possível enviar: confira o responsável e se o mês está aberto." : message);
    } finally { setSaving(false); }
  }

  function openReview(request: PointAdjustmentRequest) {
    setReviewing(request);
    setReviewTimes(requestedTimes(request));
    setReviewNotes("");
  }

  async function approve() {
    if (!reviewing || !user || !validateTimes(reviewTimes)) { toast.error("Revise a ordem dos horários."); return; }
    setSaving(true);
    try {
      await completeAdjustment({ data: {
        requestId: reviewing.id,
        clockIn: localTimeToISO(reviewing.work_date, reviewTimes.clockIn),
        lunchStart: localTimeToISO(reviewing.work_date, reviewTimes.lunchStart),
        lunchEnd: localTimeToISO(reviewing.work_date, reviewTimes.lunchEnd),
        clockOut: localTimeToISO(reviewing.work_date, reviewTimes.clockOut),
        reviewNotes,
      } });
      await logAudit({ actorId: user.id, actorName: profile?.full_name ?? "", action: "adjustment_approved", entity: "point_adjustment_request", entityId: reviewing.id, details: { employee: names.get(reviewing.employee_id), date: reviewing.work_date } });
      toast.success("Ajuste aprovado e ponto corrigido.");
      setReviewing(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["point-adjustment-requests"] }), queryClient.invalidateQueries({ queryKey: ["records"] })]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir o ajuste."); }
    finally { setSaving(false); }
  }

  async function reject() {
    if (!reviewing || !user) return;
    if (!reviewNotes.trim()) { toast.error("Informe o motivo da recusa."); return; }
    setSaving(true);
    try {
      await rejectAdjustment({ data: { requestId: reviewing.id, reviewNotes: reviewNotes.trim() } });
      await logAudit({ actorId: user.id, actorName: profile?.full_name ?? "", action: "adjustment_rejected", entity: "point_adjustment_request", entityId: reviewing.id, details: { employee: names.get(reviewing.employee_id), date: reviewing.work_date } });
      toast.success("Solicitação recusada.");
      setReviewing(null);
      await queryClient.invalidateQueries({ queryKey: ["point-adjustment-requests"] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível recusar a solicitação."); }
    finally { setSaving(false); }
  }

  const rows = requests.data ?? [];
  return <div>
    <PageHeader title="Ajustes de ponto" description={isAdmin ? "Analise as solicitações atribuídas a você e corrija os horários antes de concluir." : "Informe os horários corretos e acompanhe a análise do seu responsável."} />

    {!isAdmin && <Card className="mb-6 border-border/70">
      <CardHeader><CardTitle className="flex items-center gap-2"><FilePenLine className="h-5 w-5 text-primary" />Nova solicitação</CardTitle><CardDescription>{responsible.data ? <>Responsável: <strong className="text-foreground">{responsible.data.full_name}</strong></> : "Peça a um administrador para definir seu responsável antes de solicitar um ajuste."}</CardDescription></CardHeader>
      <CardContent><form className="space-y-4" onSubmit={requestAdjustment}>
        <div className="max-w-xs space-y-1.5"><Label htmlFor="work-date">Data do registro</Label><Input id="work-date" type="date" max={todayISO()} value={date} onChange={(event) => setDate(event.target.value)} required /></div>
        <TimeFields value={times} onChange={setTimes} />
        <Button type="submit" disabled={saving || !responsible.data}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Enviar solicitação</Button>
      </form></CardContent>
    </Card>}

    <div className="overflow-x-auto rounded-lg border border-border">
      <Table><TableHeader><TableRow>{isAdmin && <TableHead>Funcionário</TableHead>}<TableHead>Data</TableHead><TableHead>Horários solicitados</TableHead><TableHead>Enviada em</TableHead><TableHead>Status</TableHead><TableHead>Observação</TableHead>{isAdmin && <TableHead className="text-right">Ação</TableHead>}</TableRow></TableHeader>
        <TableBody>
          {rows.map((request) => <TableRow key={request.id}>
            {isAdmin && <TableCell className="font-medium">{names.get(request.employee_id) ?? "Funcionário"}</TableCell>}
            <TableCell>{formatDate(request.work_date)}</TableCell>
            <TableCell className="whitespace-nowrap text-clock text-xs">{formatTime(request.requested_clock_in)} · {formatTime(request.requested_lunch_start)} · {formatTime(request.requested_lunch_end)} · {formatTime(request.requested_clock_out)}</TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(request.created_at)}</TableCell>
            <TableCell><StatusBadge status={request.status} /></TableCell>
            <TableCell className="max-w-52 text-xs text-muted-foreground">{request.review_notes ?? "—"}</TableCell>
            {isAdmin && <TableCell className="text-right"><Button size="sm" variant="outline" disabled={request.status !== "pending"} onClick={() => openReview(request)}>{request.status === "pending" ? "Analisar" : statusLabel[request.status] ?? request.status}</Button></TableCell>}
          </TableRow>)}
          {!requests.isLoading && rows.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 7 : 5} className="py-10 text-center text-muted-foreground"><Clock3 className="mx-auto mb-2 h-5 w-5" />{isAdmin ? "Nenhuma solicitação atribuída a você." : "Você ainda não enviou solicitações."}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>

    <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Revisar ajuste de {reviewing ? formatDate(reviewing.work_date) : ""}</DialogTitle></DialogHeader>
      <div className="space-y-5"><div><p className="mb-2 text-sm font-medium">Funcionário</p><p className="text-sm text-muted-foreground">{reviewing ? names.get(reviewing.employee_id) : ""}</p></div><TimeFields value={reviewTimes} onChange={setReviewTimes} /><div className="space-y-1.5"><Label htmlFor="review-notes">Observação da análise</Label><Textarea id="review-notes" maxLength={500} placeholder="Obrigatória em caso de recusa" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} /></div></div>
      <DialogFooter className="gap-2"><Button variant="destructive" onClick={reject} disabled={saving}><X className="h-4 w-4" />Recusar</Button><Button onClick={approve} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Corrigir e concluir</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
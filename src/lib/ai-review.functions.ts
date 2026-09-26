import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecordSchema = z.object({
  employee: z.string(),
  date: z.string(),
  weekday: z.string(),
  holiday: z.string().nullable(),
  scheduled: z.string().nullable(),
  clock_in: z.string().nullable(),
  lunch_start: z.string().nullable(),
  lunch_end: z.string().nullable(),
  clock_out: z.string().nullable(),
  worked_minutes: z.number(),
  scheduled_minutes: z.number(),
  notes: z.string().nullable(),
});

export const reviewRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ period: z.string(), records: z.array(RecordSchema).min(1).max(400) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Serviço de IA não configurado.");

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system:
        "Você é um auditor de controle de ponto no Brasil. Analise os registros e identifique inconsistências: marcações faltando (sem saída, intervalo incompleto), intervalo menor que 1h ou maior que 2h em jornadas acima de 6h, jornada acima de 10h, horas extras recorrentes, atrasos relevantes, trabalho em feriado ou fim de semana, horários fora de ordem, faltas em dia de jornada prevista. Responda em português do Brasil, em Markdown, com: 1) um resumo geral curto; 2) uma lista 'Casos para revisão' agrupada por funcionário, cada item com data (DD/MM/AAAA), problema e ação sugerida, do mais grave ao menos grave; 3) se não houver problemas, diga isso. Seja objetivo, máximo ~500 palavras.",
      prompt: `Período: ${data.period}\nRegistros (horários em America/Sao_Paulo):\n${JSON.stringify(data.records)}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    try {
      const text = await result.text;
      if (!text.trim()) throw new Error("A IA não retornou uma análise.");
      return { summary: text };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      if (status === 429) throw new Error("Muitas solicitações. Aguarde um momento e tente novamente.");
      if (status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace.");
      if (status === 403) throw new Error("Acesso à IA bloqueado para este workspace.");
      throw new Error(e?.message ?? "Falha ao analisar os registros.");
    }
  });

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Regras do projeto

- Multi-tenant por linha: toda tabela de dados tem `company_id` (default `current_company_id()`), e as políticas RLS isolam por empresa — garante que um cliente nunca veja dados de outro.
- Provisionamento de clientes acontece em `src/lib/provisioning.server.ts`, chamado pelo webhook público de pagamentos — evita criação manual de contas na venda.
- Novas vendas usam a integração gerenciada do Stripe com checkout incorporado; dados antigos de Cakto e Asaas são apenas históricos — mantém uma única origem ativa de cobrança.
- Customizações exclusivas de um cliente ficam em `companies.custom_features` (JSONB) — permite ligar recursos sob medida sem afetar as demais empresas.
- Ajustes solicitados por funcionários são concluídos atomicamente pelas funções do banco, que corrigem o ponto e registram o histórico — evita aprovação parcial ou perda de auditoria.

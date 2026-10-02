# Substituição da cobrança pelo Stripe

## Resultado
- Retirar o Asaas do fluxo de novas vendas.
- Oferecer os planos Start, Pro e Enterprise, mensal e anual, em uma página pública.
- Abrir o pagamento seguro dentro do ID Point e orientar o primeiro acesso após a confirmação.
- Manter a Webber Tech vitalícia e sem cobrança.

## Implementação
1. Criar a estrutura de assinaturas por empresa, separando ambiente de teste e produção, com isolamento por empresa.
2. Ligar pagamentos e renovações ao provisionamento existente: compra aprovada cria/reativa empresa e administrador; falha de cobrança registra atraso; cancelamento mantém acesso até o fim do período pago.
3. Criar o checkout público com os seis preços já cadastrados e coleta dos dados da empresa responsável pela compra.
4. Aplicar as regras comerciais: upgrade imediato com ajuste proporcional; downgrade no próximo ciclo; impedir assinatura duplicada.
5. Atualizar a tela administrativa de Assinaturas para mostrar os dados da nova cobrança.
6. Remover o endpoint do Asaas do aplicativo e manter os dados históricos apenas no banco.
7. Testar a página em celular e computador, o checkout de teste, o retorno da compra e os estados de erro.

## Detalhes técnicos
- Checkout incorporado e protegido, com cálculo e cobrança de tributos; a apuração e o recolhimento continuam com a empresa/contabilidade no Brasil.
- Eventos externos validados por assinatura antes de alterar qualquer empresa.
- Valores: Start R$ 59,90/mês ou R$ 574,80/ano; Pro R$ 199,90/mês ou R$ 1.918,80/ano; Enterprise base R$ 299,90/mês ou R$ 2.878,80/ano.
- O adicional Enterprise de R$ 3,90 por funcionário acima de 50 fica fora do checkout automático inicial e será tratado comercialmente.

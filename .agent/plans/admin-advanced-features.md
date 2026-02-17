# Plano: Admin Advanced Features (V1)

Este plano descreve a implementação do Banco de Horas, Feed de Alertas e Gestão de Documentos no Painel Administrativo.

## 🏗️ Fase 1: Motor de Cálculo de Banco de Horas
- **Objetivo**: Calcular o saldo de horas de cada funcionário baseado em uma jornada de 8h.
- **Implementação**:
    - Criar helper `timeUtils.js` com função `calculateDailyBalance(logs, expectedHours = 8)`.
    - Integrar o cálculo no `EmployeesTab` para mostrar o saldo acumulado (do mês atual).
    - Adicionar visual switch no relatório para ver "Saldo do Dia".

## 🔔 Fase 2: Feed de Alertas & Notificações (Real-time)
- **Objetivo**: Centralizar ocorrências críticas no dashboard inicial.
- **Implementação**:
    - Atualizar `OverviewTab.jsx` para incluir uma coluna lateral "Alertas Críticos".
    - Filtrar logs em tempo real para exibir:
        - Batidas fora do perímetro (> Geofence radius).
        - Justificativas enviadas recentemente.
        - Status de "Ausente" programado para o dia.

## 📂 Fase 3: Gestão de Documentos (Atestados)
- **Objetivo**: Permitir anexar provas a registros abonados.
- **Implementação**:
    - Atualizar o `ReportsTab.jsx` para incluir botão "Anexar Documento" nos logs.
    - Implementar Preview de Documento (Base64) similar ao preview de foto facial.
    - Adicionar marcador visual na tabela para registros que possuem atestado anexo.

## ✅ Critérios de Sucesso
- [ ] O saldo de horas é exibido corretamente na lista de funcionários.
- [ ] O feed de alertas destaca registros fora do perímetro em vermelho vibrante.
- [ ] É possível subir um arquivo de imagem como justificativa (atestado) e visualizá-lo no painel.

---
**Próximo Passo**: Iniciar Fase 1 com a criação do `timeUtils.js`.

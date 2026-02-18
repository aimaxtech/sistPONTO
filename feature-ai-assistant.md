# Task: Implementação da RAQUEL (AI Assistant) 🤖🚀

Implementação da RAQUEL (Relatórios e Automação Quântica com Entendimento de Linguagem), nossa assistente inteligente integrada com Gemini AI.

## Objetivo
* Interface de chat flutuante (Floating Bubble) no Painel Admin.
* Integração com a API do Gemini (Google Generative AI).
* Suporte a "Function Calling" para consultar logs, listar funcionários e aplicar abonos.
* UX focada em produtividade (Linguagem Natural).

## Fase 1: Fundação & UI
- [ ] Instalar dependência `@google/generative-ai`.
- [ ] Criar o componente `AIChatBubble.jsx` com design Glassmorphism.
- [ ] Implementar o estado de chat e histórico na interface.

## Fase 2: Cérebro (Gemini Integration)
- [ ] Configurar o serviço `aiService.js`.
- [ ] Implementar ferramentas básicas (Tools):
    * `getEmployeesList`: Retorna nomes e IDs.
    * `getAttendanceReport`: Busca logs filtrados.
- [ ] Criar o "System Prompt" para definir a personalidade e restrições.

## Fase 3: Ações Administrativas (Escrita)
- [ ] Implementar ferramenta `approveJustification`.
- [ ] Implementar ferramenta `adjustWorkHours`.
- [ ] Adicionar fluxo de confirmação manual do usuário para ações de escrita.

## Fase 4: Polimento & Deploy
- [ ] Testar cenários de erro (falta de chave API, offline).
- [ ] Deploy para produção.

---

## 📅 Log de Execução

- **2026-02-18**: Início do projeto PontoGPT. Plano aprovado pelo usuário.

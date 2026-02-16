# 📖 Guia de Operação - Sistema de Ponto 🌱

Bem-vindo ao manual oficial do seu novo Sistema de Gestão de Frequência. Este guia detalha as funções para Colaboradores e Administradores.

---

## 📱 Para o Colaborador (Painel do Funcionário)

### 1. Como registrar seu ponto
1.  **Acesse o sistema** utilizando sua **Matrícula** e **Senha**.
2.  No carrossel de botões, selecione o **Tipo de Operação** (Ex: Entrada, Saída Almoço, Saída Final).
3.  Clique em **"Iniciar Captura Facial"**.
4.  Posicione o rosto e tire a foto.
5.  Clique em **"Confirmar Registro"**.

### 2. Entendendo os Indicadores
*   **Trabalhado Hoje**: Mostra quantas horas e minutos você já acumulou **apenas no dia de hoje**. Se você estiver em um turno ativo (bateu entrada e ainda não bateu saída), o relógio atualizará automaticamente a cada 30 segundos.
*   **Banco Saldo**: Reflete seu histórico acumulado do mês (até ontem). Se estiver verde com um "+", você tem horas extras. Se estiver vermelho com um "-", você tem horas a compensar.

---

## 🖥️ Para o Gestor (Painel Administrativo - Matrícula 1001)

### 1. Gestão de Abonos (Saídas Eventuais)
O diferencial deste sistema é a gestão de saídas durante o expediente (ex: ida ao médico).
1.  Vá até a aba **Relatórios**.
2.  Gere o relatório do dia ou do período desejado.
3.  Localize as linhas de **Saída Eventual**. 
4.  Clique no botão **"Abonar?"** para validar aquele período como tempo trabalhado. O sistema recalculará o banco de horas do funcionário instantaneamente.

### 2. Auditoria e Relatórios
*   **Resumo Analítico**: No topo de cada busca, você verá o total de registros e abonos realizados, facilitando o fechamento do mês.
*   **Exportação**: Você pode baixar os relatórios em **PDF** (para assinatura) ou **CSV/Excel** (para processamento em planilhas).
*   **Mapa de Localização**: Clique nas coordenadas de cada registro para ver exatamente onde o funcionário estava no momento da batida (Geofence).

---

## 🔐 Credenciais de Teste / Configuração Inicial

### Administrador Master
*   **Matrícula**: `1001`
*   **Senha**: `123456` (ou a senha definida na primeira execução)
*   **Função**: Cadastro de novos usuários, abonos, exclusão de registros e auditoria.

### Novo Funcionário
Para testar como funcionário, entre no painel Admin e cadastre uma nova matrícula (ex: `1050`).

---

## 📡 Sincronização & Offline
O sistema possui tecnologia **Offline-First**. Caso a internet na estufa caia:
1.  O funcionário pode bater o ponto normalmente.
2.  O sistema salvará os dados localmente no dispositivo.
3.  Assim que a conexão retornar, o funcionário verá um alerta e os dados serão sincronizados automaticamente com o Firebase.

---
*© 2026 Sistema de Ponto • Estufa de Mudas • Protocolo de Segurança Ativo*

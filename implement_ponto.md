# Sistema de Ponto Eletrônico (PWA) - Estufa de Mudas

Este documento define o plano de implementação para o sistema de controle de ponto com geolocalização e captura de fotos.

## 🎯 Objetivo
Criar uma aplicação web progressiva (PWA) simples e robusta para 2 funcionários registrarem ponto (entrada/saída) com validação de local e foto, gerenciada por um administrador.

## 🛠️ Stack Tecnológico
- **Frontend Framework:** React (Vite)
- **Estilização:** TailwindCSS (Design Responsivo e Moderno)
- **Backend/Database:** Firebase (Authentication, Firestore, Storage)
- **Recursos Nativos:** Geolocation API (GPS), Camera API (MediaDevices)
- **Hospedagem:** Firebase Hosting (Gratuito)

## 📋 Estrutura de Dados (Firestore)

### Coleção: `users`
- `uid` (string): ID do Auth
- `name` (string): Nome completo
- `role` (string): 'admin' | 'employee'
- `email` (string): Email de acesso
- `photoUrl` (string): Foto de perfil (opcional)
- `status` (string): 'ativo' | 'ferias' | 'afastado'
- `statusStart` (string): Data Inicio Status (YYYY-MM-DD)
- `statusEnd` (string): Data Fim Status (YYYY-MM-DD)

### Coleção: `time_records` (punches)
- `id` (string): Auto-gerado
- `userId` (string): ID do funcionário
- `timestamp` (timestamp): Data e hora exata do registro
- `type` (string): 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida' | 'saida_eventual' | 'volta_eventual'
- `location` (geoPoint): Latitude/Longitude
- `photoUrl` (string): URL da foto tirada no momento (Storage)
- `deviceInfo` (string): Info básica do dispositivo (opcional, para segurança)
- `isAbonado` (boolean): Se a saída eventual foi abonada
- `justification` (string): Justificativa do funcionário

## 🚀 Fases do Projeto

### Fase 1: Configuração Inicial e Infraestrutura
- [x] Inicializar projeto React com Vite
- [x] Configurar TailwindCSS
- [x] Configurar Firebase (Auth, Firestore, Storage)
- [x] Criar Contexto de Autenticação (Login/Logout)

### Fase 2: Interface do Administrador
- [x] Tela de Login (Admin/Func)
- [x] Dashboard Principal (Visão Geral)
- [x] Cadastro de Funcionários (Criar conta email/senha)
- [x] Relatório de Pontos (Tabela com filtros de data)
- [x] Visualização de Detalhes (Foto + Mapa do local)
- [x] Gestão de Abonos e Status (Férias/Afastamentos)

### Fase 3: Interface do Funcionário (Mobile First)
- [x] Home Simplificada (Botão Grande "Registrar Ponto")
- [x] Lógica de Captura de Localização (GPS)
- [x] Componente de Câmera (Tirar Selfie)
- [x] Feedback Visual de Sucesso/Erro
- [x] Histórico Recente (Últimos registros do dia) & Banco de Horas

### Fase 4: Regras de Negócio e Validações
- [x] Bloquear registro sem GPS/Câmera (Implementado, validação visual no Admin)
- [x] Calcular distância da Estufa (Geofencing auditável no Admin)
- [x] Proteção de Rotas (Admin vs Employee)

### Fase 5: Polimento e Deploy
- [x] Otimizar para Mobile (Touch icons, Manifest PWA)
- [ ] Testes Finais de Usabilidade (Em Progresso)
- [ ] Deploy no Firebase Hosting

## 📝 Próximos Passos Imediatos
1. Executar testes finais simulando fluxo completo (Admin cria user -> User bate ponto -> Admin valida).
2. Verificar responsividade em dispositivos móveis reais (via deploy ou tunnel).
3. Realizar deploy final no Firebase Hosting.

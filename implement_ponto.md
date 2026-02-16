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

### Coleção: `time_records`
- `id` (string): Auto-gerado
- `userId` (string): ID do funcionário
- `timestamp` (timestamp): Data e hora exata do registro
- `type` (string): 'entrada' | 'saida_almoco' | 'volta_almoco' | 'saida'
- `location` (geoPoint): Latitude/Longitude
- `photoUrl` (string): URL da foto tirada no momento (Storage)
- `deviceInfo` (string): Info básica do dispositivo (opcional, para segurança)

## 🚀 Fases do Projeto

### Fase 1: Configuração Inicial e Infraestrutura
- [ ] Inicializar projeto React com Vite
- [ ] Configurar TailwindCSS
- [ ] Configurar Firebase (Auth, Firestore, Storage)
- [ ] Criar Contexto de Autenticação (Login/Logout)

### Fase 2: Interface do Administrador
- [ ] Tela de Login (Admin/Func)
- [ ] Dashboard Principal (Visão Geral)
- [ ] Cadastro de Funcionários (Criar conta email/senha)
- [ ] Relatório de Pontos (Tabela com filtros de data)
- [ ] Visualização de Detalhes (Foto + Mapa do local)

### Fase 3: Interface do Funcionário (Mobile First)
- [ ] Home Simplificada (Botão Grande "Registrar Ponto")
- [ ] Lógica de Captura de Localização (GPS)
- [ ] Componente de Câmera (Tirar Selfie)
- [ ] Feedback Visual de Sucesso/Erro
- [ ] Histórico Recente (Últimos registros do dia)

### Fase 4: Regras de Negócio e Validações
- [ ] Bloquear registro sem GPS/Câmera
- [ ] Calcular distância da Estufa (Opcional: Alerta de "Fora do Local")
- [ ] Proteção de Rotas (Admin vs Employee)

### Fase 5: Polimento e Deploy
- [ ] Otimizar para Mobile (Touch icons, Manifest PWA)
- [ ] Testes Finais de Usabilidade
- [ ] Deploy no Firebase Hosting

## 📝 Próximos Passos Imediatos
1. Criar o projeto Vite + React.
2. Instalar dependências (Firebase, Router, Icons).
3. Configurar o projeto no Console do Firebase.

# Sistema de Ponto - Estufa de Mudas

Sistema PWA (Progressive Web App) para controle de ponto eletrônico com geolocalização e captura de foto.

## 🚀 Tecnologias

- **React** + **Vite** - Framework e build tool
- **TailwindCSS** - Estilização
- **Firebase** - Backend (Auth, Firestore, Storage)
- **Geolocation API** - Captura de localização
- **MediaDevices API** - Captura de foto

## 📋 Pré-requisitos

1. Node.js 18+ instalado
2. Conta no Firebase (gratuita)

## ⚙️ Configuração

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Ative os seguintes serviços:
   - **Authentication** (Email/Password)
   - **Firestore Database**
   - **Storage**
4. Copie as credenciais do projeto
5. Edite o arquivo `src/config/firebase.js` e substitua as credenciais

### 3. Configurar Localização da Estufa

Edite `src/config/firebase.js` e ajuste as coordenadas:

```javascript
export const GREENHOUSE_LOCATION = {
  latitude: -23.550520,  // Sua latitude
  longitude: -46.633308, // Sua longitude
  radius: 100 // Raio em metros
};
```

**Dica:** Use o Google Maps para obter as coordenadas exatas da estufa.

### 4. Criar Primeiro Usuário Admin

No Firebase Console:
1. Vá em **Authentication** > **Users**
2. Clique em **Add User**
3. Crie um usuário com email e senha
4. Copie o **UID** do usuário criado
5. Vá em **Firestore Database**
6. Crie uma coleção chamada `users`
7. Adicione um documento com o UID como ID:

```json
{
  "name": "Administrador",
  "email": "admin@estufa.com",
  "role": "admin"
}
```

## 🏃 Executar o Projeto

```bash
npm run dev
```

O sistema abrirá em `http://localhost:3000`

## 📱 Usar como PWA no Celular

1. Acesse o sistema pelo navegador do celular
2. No Chrome: Menu > "Adicionar à tela inicial"
3. No Safari (iOS): Compartilhar > "Adicionar à Tela de Início"

## 👥 Funcionalidades

### Admin
- ✅ Login
- ✅ Dashboard com visão geral
- 🚧 Cadastro de funcionários (em desenvolvimento)
- 🚧 Relatórios de ponto (em desenvolvimento)

### Funcionário
- ✅ Login
- ✅ Registro de ponto com 4 tipos (Entrada, Saída Almoço, Volta Almoço, Saída)
- ✅ Captura de localização GPS
- ✅ Captura de foto (selfie)
- 🚧 Histórico de registros (em desenvolvimento)

## 📝 Próximos Passos

Consulte o arquivo `implement_ponto.md` para ver o roadmap completo.

## 🔒 Segurança

- Autenticação via Firebase Auth
- Rotas protegidas por papel (admin/employee)
- Validação de localização
- Registro imutável com timestamp do servidor

## 📄 Licença

Projeto privado - Estufa de Mudas

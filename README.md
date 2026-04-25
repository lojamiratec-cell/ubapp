# App Motorista Alta Performance (Driver Analytics)

O **Driver Analytics** é um PWA (Progressive Web App) desenvolvido sob medida para motoristas de aplicativos (Uber, 99, inDrive) que buscam **Alta Performance**. Diferente de planilhas tradicionais, o app foca em rentabilidade por hora (R$/Hora) e por KM (R$/KM), agindo como uma telemetria em tempo real para otimizar os lucros do motorista e guiá-lo durante o dia a dia através de IA integrada.

## 🎨 Layout e UI/UX

O design foi pensado para ser utilizado no **carro**, em movimento ou paradas rápidas:
- **Mobile-First & Touch-Friendly:** Botões grandes para interações rápidas, inputs visuais amplos e sem necessidade de digitações complexas durante a operação.
- **Visual "Telemetria / F1":** O foco é na clareza dos números importantes (Lucro Real, R$/h, Rentabilidade).
- **Dark Mode Nativo:** Como motoristas rodam muito à noite e também para economizar bateria, utilizamos o Dark Mode com cores profundas (`bg-gray-900`) misturado com brancos contrastantes e alertas em cores neon.
- **Feedback por Cores (Sinais Vitais):** 
  - 🟢 **Verde (`text-green-500`):** Operação rentável, cumprimento de metas, viagem acima da média.
  - 🔴 **Vermelho (`text-red-500`):** Prejuízo, perigo de faturamento, corridas canceladas, dias não detalhados.
  - 🔵 **Azul (`text-blue-500`):** Ações primárias, navegação e "buscando passageiro".
  - ⚪️ **Cinza (`text-gray-500`):** Tempo ocioso.
- **Animações (Framer Motion):** Transições fluidas ao alternar entre categorias ou expandir menus, provendo uma experiência de uso imersiva.

## 🛠 Tecnologias Utilizadas

- **Frontend:** React 18 com **Vite** (Typescript)
- **Estilização:** **Tailwind CSS** para utilitários responsivos e rápidos.
- **Ícones e Gráficos:** **Lucide React** para iconografia limpa e **Recharts** para gráficos analíticos de desempenho.
- **Animações:** **Framer Motion** (`motion/react`) para layouts e efeitos de transição escaláveis.
- **Inteligência Artificial:** **Google Gemini API** (`@google/genai`), provendo a engine analítica que avalia o cenário ao vivo do motorista e envia "dicas táticas" de alta performance.
- **BaaS (Backend, Banco de Dados e Auth):** **Firebase** (Firestore para armazenamento na nuvem e Firebase Auth para controle de usuários). PWA com suporte a uso offline persistente do Firestore.

## 📦 Módulos e Funcionalidades

O app é dividido em **5 pilares (Abas):**

### 1. Operação (Motor)
*O coração do app para gerenciar o momento atual.*
- Iniciar / Pausar / Parar turno atualizando Hodômetro.
- **Estados de Produtividade Rápida:** Um toque para alternar entre "Parado (Ocioso)", "Buscando (Online)" e "Corrida (Em trajeto)", ajudando a monitorar o tempo ativo perfeitamente.
- Cálculo Exato do **KM Trabalho vs KM Pessoal**.
- Registro ultrarrápido das **corridas concluídas** (duração, distância, valor, indicação de cancelamento).
- **Copiloto IA:** Avalia o cenário da hora atual vs hora seguinte e recomenda parar ou acelerar.

### 2. Histórico (Controle Passado)
*Visão ampla dos dias trabalhados.*
- Linha do tempo dos agrupamentos por data, permitindo expansão do dia em seus receptivos turnos e corridas detalhadas.
- **Filtros Estratégicos:** Visões simplificadas para Semana e Mês.
- Filtro de **Pendências "Vermelhas"**: Botão ágil para mostrar apenas os dias/turnos onde o motorista declarou faturamento, mas esqueceu de detalhar suas corridas.
- Edição do passado: Permite corrigir quilometragens, e ganhos declarados no formato Pós-Turno.
- Exportação inteligente e densa para formato **CSV**.

### 3. Carteira (Finanças e Custos)
*Controle de gastos tangíveis e de progressão mensal financeira.*
- Cadastro e rastreamento de **Despesas e Abastecimentos**, controlando média de km/L do veículo.
- Cadastro de **Contas Fixas Mensais** (IPVA, Seguro, Financiamento).
- Cálculo do lucro **Líquido Final** do mês atual e o "Real Restante Estimado".

### 4. Insights (Business Intelligence)
*Análises profundas utilizando o histórico do motorista.*
- **Top 20% / Relatório Tático de IA:** A Inteligência Artificial levanta dados semanais ou mensais do motorista, diagnostica e orienta como cobrar mais gerando mais horas produtivas e filtrando preços baixos.
- **Mapeamento Horário:** Gráfico em radar descobrindo qual é o melhor horário da semana em termos de R$/Hora e R$/Km.
- Destaque das X piores e melhores corridas registradas no tempo.

### 5. Configurações
*Gerenciamento e conta.*
- Definição de Metas Foco: Expectativa de ganho financeiro mensal, R$/Hora mínimo aceitável.
- Preferência visual de Tema (Claro / Escuro).
- Log out seguro, Importação Inteligente usando IA pra ler dezenas de formatos colados (texto, csv, zap) e converter para turnos dentro do Firestore.

---

O app foi projetado do zero com base em rigor e precisão lógica no armazenamento diário, visando erradicar e combater cálculos mal feitos que escanem ou deixem o motorista de app trabalhar em prejuízo numérico diário.

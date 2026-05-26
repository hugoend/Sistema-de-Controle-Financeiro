# 💰 Finanças da Família — Controle Financeiro Pessoal

![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![Flask](https://img.shields.io/badge/flask-%23000.svg?style=for-the-badge&logo=flask&logoColor=white)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)

Um sistema de gestão financeira familiar "local-first", focado em privacidade, simplicidade e agilidade. Desenvolvido para rodar localmente, garantindo que seus dados financeiros nunca saiam do seu controle.

---

## ✨ Funcionalidades

Baseado na lógica do backend (`app.py`), o sistema oferece:

-   **Gestão de Transações:** Cadastro de receitas e despesas com categorização e data.
-   **Dashboard Inteligente:** Filtros por mês e ano para análise de fluxo de caixa.
-   **Controle de Orçamentos:** Definição de limites mensais por categoria com atualização em tempo real (*Upsert logic*).
-   **Histórico Comparativo:** Visualização dos últimos 6 meses para acompanhamento de tendências.
-   **Gestão de Membros:** Cadastro de membros da família para personalização dos lançamentos.
-   **Persistência Robusta:** Utiliza SQLite com modo `WAL` (Write-Ahead Logging) para melhor performance e integridade de dados.

---

## 🛠️ Tecnologias

-   **Backend:** Python 3.8+ com Flask
-   **Banco de Dados:** SQLite (Embutido)
-   **Frontend:** HTML5, CSS3 e JavaScript Vanilla (armazenado em `/public`)

---

## 🚀 Instalação e Execução

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/financas-familia.git
cd financas-familia
```

### 2. Configurar Ambiente Virtual (Recomendado)
**Windows:**
```bash
python -m venv venv
.\venv\Scripts\activate
```

**Linux/macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar Dependências
```bash
pip install flask
```

### 4. Iniciar a Aplicação
```bash
python app.py
```
O servidor estará disponível em: `http://localhost:5000`

---

## 📂 Estrutura de Pastas

```
financas-familia/
├── app.py              ← Servidor principal (backend)
├── financas.db         ← Banco de dados SQLite (criado automaticamente)
├── README.md
└── public/
    ├── index.html      ← Interface principal
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

---

## 🔧 Funcionalidades

| Seção         | O que faz                                              |
|---------------|--------------------------------------------------------|
| Dashboard     | Resumo do mês: receitas, despesas, saldo e gráfico     |
| Lançamentos   | Adicionar e excluir receitas/despesas com categoria    |
| Categorias    | Ver gasto por categoria com barra de progresso         |
| Orçamentos    | Definir limite mensal por categoria com alerta         |
| Histórico     | Gráfico comparativo dos últimos 6 meses                |
| Membros       | Cadastrar os membros da família                        |

---

## 💾 Backup dos dados

Os dados ficam no arquivo `financas.db`. Para fazer backup:
```bash
cp financas.db financas_backup_$(date +%Y%m%d).db
```

---

## 🌐 Acesso pela rede local (outros dispositivos)

Para acessar pelo celular ou outro computador da mesma rede Wi-Fi,
edite a última linha do `app.py` e descubra o IP do computador:

```bash
# Linux/macOS
ip addr show | grep "inet "

# Windows
ipconfig
```

Então acesse de outro dispositivo:  `http://SEU_IP:5000`

---

## ❓ Problemas comuns

**"ModuleNotFoundError: No module named 'flask'"**
```bash
pip install flask
# ou
pip3 install flask
```

**"Port 5000 is already in use"**
```bash
# Trocar porta: edite app.py, última linha:
app.run(host='0.0.0.0', port=8080, debug=False)
# Acessar em: http://localhost:8080
```

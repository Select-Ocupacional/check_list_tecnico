# Select Ocupacional - Check-list Técnico (SST)

Este repositório armazena a aplicação de Check-list de Visita Técnica da **Select Ocupacional**, projetada para otimizar os processos de auditoria e levantamento de riscos em Saúde e Segurança do Trabalho (SST).

## 📋 Escopo da Aplicação
O sistema deve permitir que o técnico realize o levantamento de:
* Dados gerais do cliente e da unidade visitada.
* Condições ambientais e riscos ocupacionais (Físicos, Químicos, Biológicos, Ergonômicos e de Acidentes).
* Verificação de uso e conformidade de EPIs/EPCs.
* Registro fotográfico de não-conformidades (evidências).
* Coleta de assinatura digital do responsável da empresa visitada.

## 🚀 Tecnologias Planejadas
* Desenvolvimento assistido por IA (Claude / GitHub Copilot).
* [A definir: Stack técnica final].

## 🗂️ Estrutura do Repositório
```
docs/     → documentação de arquitetura e decisões de projeto
schema/   → contrato de dados (JSON Schema) e exemplos
```

## 🏗️ Arquitetura e Dados (SST-01)
A modelagem de dados da aplicação está definida em:
* [`docs/01-arquitetura-e-estrutura-de-dados.md`](docs/01-arquitetura-e-estrutura-de-dados.md) — princípios (offline-first, mobile-first, LGPD), entidades, diagramas e regras de negócio.
* [`schema/checklist-visita-tecnica.schema.json`](schema/checklist-visita-tecnica.schema.json) — contrato de validação formal (JSON Schema 2020-12), fonte única de integridade dos dados.
* [`schema/exemplo-checklist-preenchido.json`](schema/exemplo-checklist-preenchido.json) — instância de exemplo válida contra o schema.

## 🛠️ Como Contribuir / Próximos Passos
As tarefas e o cronograma de desenvolvimento deste projeto são gerenciados diretamente através do **GitHub Project: Tecnico** da organização.

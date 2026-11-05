# Mapeamento Check-list → SOC (importação por planilha)

> `[RASCUNHO - AGUARDA REVISÃO]`
> **Data:** 04/11/2026 · **Departamento:** Técnico · **Schema do check-list:** 1.10.0
> **Fonte:** planilhas-modelo baixadas do próprio SOC — tela 1248 (Importação de Hierarquia, `modelo_hierarquia.xlsx`) e tela 864 (Importação de Aplicação de Riscos, `modelo_aplicacao_riscos.xls`).
> Este documento descreve apenas a **estrutura** das planilhas (nomes de colunas). Não contém dados de clientes nem credenciais.

---

## 0. Fluxo pré-visita (informado pelo responsável)

Antes da visita, o SOC já recebe o cadastro de **Empresa → Setores → Cargos → Funcionários**. A fonte é o **PGR/PCMSO anterior** e a **Ficha de Registro do Funcionário**, enviados pelo cliente.

**Consequência para o check-list:** a hierarquia (e a contagem de funcionários por cargo) **já existe no SOC quando o técnico chega**. O check-list deve **partir dela** (pré-carregar e o técnico confirmar, corrigir ou incluir) em vez de digitar do zero. Assim, os códigos SOC de unidade, setor e cargo vêm junto e a importação 1248 passa a ser só de **ajustes**.

- **Funcionários:** para o check-list basta a **quantidade por cargo** (campo `funcoes[].quantidade`). Nome, CPF e demais dados pessoais **não** devem ir para o aparelho (LGPD — minimização).

---

## 1. Ordem obrigatória de importação no SOC

1. **Hierarquia (tela 1248)** — cria/atualiza Unidade → Setor → Cargo.
2. **Aplicação de Riscos (tela 864)** — aplica riscos, medições e EPIs à hierarquia.

A própria planilha 864 avisa: *a hierarquia precisa existir no SOC* e *o CA do EPI precisa estar cadastrado na tela de EPI (164)* antes da importação. Acima de 200 linhas, o SOC gera um Pedido de Processamento.

---

## 2. Tela 1248 — Importação de Hierarquia (1 aba, cabeçalho na linha 2)

| Coluna SOC | Obrig. | Campo no check-list | Situação |
|---|---|---|---|
| Cod. Unid. / Cod. Setor / Cod. Cargo | — | — | ❌ Falta. Sem o código, há risco de **duplicar** a hierarquia no SOC. |
| Nome Unidade | ✅ | `unidade.nome` | ✔ |
| Nome Setor | ✅ | `setores[].nome` | ✔ |
| Nome Cargo | ✅ | `setores[].funcoes[].nome` | ✔ |
| Hierarquia Ativa (S/N) | — | — | Fixo "S" |
| Grau Risco | — | `unidade.grau_risco` | ✔ |
| CNPJ Unidade | — | `cliente.cnpj` | ⚠️ O check-list só guarda o CNPJ do cliente; filial pode ter CNPJ próprio. |
| Endereço / Nº / Complemento / Bairro / Cidade / Estado / CEP Unidade | — | `unidade.endereco` | ✔ (conferir campos) |
| Razão Social Unid. | — | `cliente.razao_social` | ⚠️ idem CNPJ |
| CNAE (e variações) | — | `unidade.cnae_principal` | ✔ (definir qual coluna de CNAE usar) |
| Descrição Setor | — | `setores[].descricao` | ✔ |
| Função / CBO / Descrição Detalhada do Cargo | — | — | ❌ Falta (descrição de atividades do cargo, CBO) |
| Endereço de cobrança, CPF/CAEPF/CEI, Inscrição | — | — | Fora do escopo do check-list |

---

## 3. Tela 864 — Importação de Aplicação de Riscos (4 abas)

Todas as abas repetem a chave: **Origem (Nome) · Unidade (Código, Nome) · Setor (Código, Nome) · Cargo (Código, Nome) · Risco (Código, Nome)**.

### 3.1 Aba "Aplicação e Caracterização"

| Coluna SOC | Campo no check-list | Situação |
|---|---|---|
| Risco (Código, Nome) | `avaliacoes_risco[].agente` | ⚠️ O agente é texto livre; o SOC exige o **código do risco** do cadastro (tela 191). |
| Origem (Nome) | — | `[VERIFICAR NO MANUAL DO SOC]` significado do campo |
| Data Início Condição | `data_visita`? | `[CONFIRMAR COM RESPONSÁVEL]` |
| Utiliza EPI / EPI Eficaz | `verificacoes_epi_epc[]` (tipo=epi, em_uso, conforme) | ⚠️ No check-list o EPI está ligado ao **grupo** de risco; o SOC liga ao **risco (agente)**. |
| Utiliza EPC / EPC eficaz | `verificacoes_epi_epc[]` (tipo=epc) | ⚠️ idem |
| Observação referente a Registros Ambientais | `avaliacoes_risco[].observacao` | ✔ |
| Insalubridade / Periculosidade / Aposentadoria especial | — | ❌ Falta — decisão técnica (laudo), ver §5 |
| Período Vigência (Cód. Versão, Data início, Data fim) | — | ❌ Falta — versão do PGR |
| Medidas de Proteção · Condições de Funcionamento · Uso Ininterrupto · Prazo Validade do CA · Periodicidade de troca · Higienização (requisitos NR-06/NR-09) | parcial: `estado_conservacao`, `em_uso` | ❌ Maioria falta `[VERIFICAR VIGÊNCIA DA NORMA]` |
| Exclusão (Sim/Não) | — | Fixo "Não" |

### 3.2 Aba "Medição" (várias por risco; o eSocial usa a última linha)

| Coluna SOC | Campo no check-list | Situação |
|---|---|---|
| Data | `avaliacoes_risco[].quantificacao.data` | ✔ |
| Valor | `avaliacoes_risco[].indice` | ✔ |
| Unidade de medida | `avaliacoes_risco[].unidade` | ⚠️ Texto livre; alinhar à lista do SOC |
| Técnica utilizada | — (`quantificacao.equipamento` é outro dado) | ❌ Falta — catálogo da tela 184 |

### 3.3 Aba "Equipamentos" (uma linha por EPI/CA)

| Coluna SOC | Campo no check-list | Situação |
|---|---|---|
| EPI (Código) | `verificacoes_epi_epc[].descricao` | ⚠️ Texto livre; o SOC exige o código do EPI (tela 164) |
| CA | `verificacoes_epi_epc[].numero_ca` | ✔ (o CA precisa existir no SOC) |

---

## 4. O que **não** tem destino nestas duas planilhas

| Dado do check-list | Tela de destino provável no SOC | Observação |
|---|---|---|
| GHE (`ghes[]`) | Grupo de Exposição (192) / Cópia de GHE (1428) | Sem importação por planilha identificada `[VERIFICAR]` |
| Treinamentos (`treinamentos[]`) | Curso (242) / Turma (251) | Sem importação por planilha identificada `[VERIFICAR]` |
| Fonte geradora (`fonte_geradora`) | Fontes Geradoras (181) | Não aparece na planilha 864 |
| Nível de exposição, não conformidades, fotos, assinaturas | — | Ficam no relatório do check-list |

---

## 5. Fluxo pós-visita informado pelo responsável (telas 337 → 358 → 192 → 1283)

Telas analisadas no SOC em 04/11/2026, apenas em visualização, com uma empresa cliente como exemplo.

| Tela | O que é preenchido | Origem possível no check-list | Oportunidade |
|---|---|---|---|
| **337** Empresa — Parâmetros Gerais (Usa GHE / Descrições do GHE no PPP) | Configuração única por cliente | — | Não é dado de visita; o check-list pode só lembrar o pré-requisito |
| **358** GHE | GHE, Unidade, Sigla, Líder, Descrição do GHE, Descrição Detalhada, **Descrição do Local**, **Descrição das Atividades (eSocial)**, Observação, **Riscos do GHE**, Exames | `ghes[]` (nome, descricao, funcoes_ref) + riscos das funções | ➕ Coletar em campo: descrição do local e das atividades do GHE. Os riscos do GHE já podem sair do agrupamento atual (agente + valor) |
| **225** Cargo (aberto a partir da 192) | Função, **CBO**, **Descrição Detalhada (eSocial)**, Requisitos, **Descrição do Local**, **Material utilizado**, **Mobiliário utilizado**, **Local de Trabalho** | `funcoes[]` (só nome e quantidade) | ➕ Coletar por função em campo. Função, CBO e Descrição Detalhada também entram pela importação 1248 |
| **192** Grupo de Exposição — Característica do Risco | Riscos por Setor/Cargo ou por GHE (campos equivalentes à planilha 864) | `avaliacoes_risco[]` | Ver §3. Riscos escolhidos do **catálogo do SOC** (944 riscos na empresa principal, com código e grupo) |
| **1283** PGR — Inventário de Riscos | Por cargo/GHE: Perigo, **Severidade** (ex.: "1 - Lesão leve", "2 - Lesão moderada"), **Probabilidade** (ex.: "3 - Pouco provável"), **Nível de Risco** (Baixo/Moderado…), **Classificação** (Aceitável…) | `nivel_exposicao` (baixo/médio/alto/avaliar) — **escala diferente** | ➕ Trocar por Severidade × Probabilidade em campo, com nível calculado igual ao do SOC `[AGUARDA MATRIZ DE RISCO USADA PELA SELECT]` |
| **1283** PGR — Planos de Ação | Nome, Descrição, **Prioridade** (Baixa/Média/Alta/Imediata), Situação, Categoria, Exibir no relatório, Responsáveis (até 5), Data limite ou Período, **Contexto** (Toda Empresa / Unidade / GHE / Perigo) | `nao_conformidades[]` | ✔ Encaixe quase direto (ver abaixo) |

### 5.1 Não conformidades → Plano de Ação (1283)

| Plano de Ação SOC | Check-list |
|---|---|
| Nome da ação | `descricao` (resumo) |
| Descrição | `recomendacao` (+ `norma_referencia`) |
| Prioridade | `gravidade`: baixa→Baixa · media→Média · alta→Alta · critica→Imediata |
| Data limite | `data_visita` + `prazo_sugerido_dias` |
| Contexto (Unidade / GHE / Perigo) | `origem_ref` (hoje aponta para a origem; precisa permitir GHE ou risco) |
| Categoria · Responsáveis · Exibir no relatório | ❌ Falta — definir se o técnico preenche em campo |

### 5.2 Observações da análise

- **Catálogo de riscos:** o check-list usa nomes próprios (ex.: "Ruído contínuo ou intermitente", "Vibração de mãos e braços"); o SOC usa outros nomes e **códigos** (ex.: "Ruído (Trabalhista)" **e** "Ruído (Previdenciário)" como riscos separados; "Vibrações localizadas (mão-braço)"). Sem alinhar o catálogo, cada risco precisa ser "traduzido" na digitação.
- **Cliente recorrente:** no exemplo, hierarquia, GHEs e riscos já existiam no SOC. Se o check-list **carregar o que já está no SOC** (via Exporta Dados), o técnico revisa em campo em vez de levantar do zero.
- **Sem importação por planilha identificada** para GHE (358), Severidade/Probabilidade (1283) e Plano de Ação (1283) `[VERIFICAR NO MANUAL DO SOC]`. Para essas telas, o check-list pode gerar um **relatório na ordem exata das telas** para acelerar a digitação.

---

## 5A. Recursos de integração documentados no Manual do SOC (tela 280)

Fonte: tópicos 150.3 (Web Services disponíveis, atualizado em 14/04/2026), 41.14 (Exporta Dados — Segurança, atualizado em 23/09/2026) e 11.13 (Matriz de Avaliação de Risco, atualizado em 24/04/2026).

### Ler do SOC (Exporta Dados — somente leitura)

| Exporta Dados | Uso no check-list |
|---|---|
| Cadastro de Riscos da empresa (COD, NOME, **CD_AGENTE_ESOCIAL**) | Lista de agentes com código SOC e código eSocial |
| Cadastro de EPI / Cadastro de EPC | Listas para EPI/EPC (com código) |
| Cadastro de Fontes Geradoras | Lista para `fonte_geradora` |
| Técnicas de Medição | Lista para a técnica utilizada na medição |
| Hierarquias (tópico 41.10) | Pré-carregar Unidade/Setor/Cargo com códigos |
| Hierarquias do GHE | Pré-carregar GHEs e onde estão aplicados |
| Riscos Unidade (SCC) | Riscos já aplicados por setor/cargo |
| **Característica de Risco: GHE** (perigo, descrição, fundamentação legal, efeitos, lesões, fontes, tempo e tipo de exposição, **linha, coluna, nível de risco, matriz**, EPC/EPI…) | Pré-carregar a avaliação anterior para o técnico **revisar** |
| Planos de Ação — PGR | Mostrar ações pendentes do cliente na visita |

### Gravar no SOC (Web Services SOAP com WS-Security)

Disponíveis: Empresa, Unidade, Setor, **Cargo**, Funcionário, Risco (cadastro), Exame, EPI, Entrega de EPI, Licença Médica, Upload de arquivos (SOCGED), entre outros.

- **Cargo:** grava `cbo`, `descricaoDetalhada`, `descricaoLocal`, `materialUtilizado`, `mobiliarioUtilizado`, `localTrabalho`, `funcao`, `requisitosFuncao` — os mesmos dados sugeridos para coleta em campo (§5).
- **Setor / Unidade:** grava descrição do setor e dados da unidade.
- **Upload de arquivos (SOCGED):** poderia anexar o relatório PDF da visita ao cliente no SOC `[VERIFICAR ESCOPO COM RESPONSÁVEL]`.
- **Não há Web Service** para GHE, aplicação/caracterização de risco, inventário do PGR nem plano de ação. Para esses: importação 864 ou digitação.
- Escrita exige usuário Web Service (tela 337 → Configuração de Integração) e **deve passar por servidor intermediário**; nunca pelo app no navegador.

### Matriz de Avaliação de Risco (11.13)

- Configurada **por empresa** (4x4, 5x5 ou personalizada, até 10x10), baseada na BS 8800: **Linha = Frequência/Probabilidade**, **Coluna = Classificação de Efeito/Severidade**, resultado = **Nível de Risco** (até 5 níveis com nome e cor).
- O check-list deve usar **a mesma matriz** configurada no SOC para o cliente `[AGUARDA MATRIZ DE RISCO USADA PELA SELECT]`.

### Cuidados observados

- O SOC bloqueia requisições repetidas com o mesmo token de sessão ("por motivos de segurança não é permitido realizar essa ação"). Qualquer automação deve usar as **APIs oficiais** (Exporta Dados / Web Services), nunca a interface web.
- Há ambiente de homologação (P-SOC, tópico 1.3) — usar para testar integrações de escrita antes da produção `[VERIFICAR REGRAS DE USO]`.

---

## 5B. Requisitos da reunião com o Técnico de Segurança (consolidados com o SOC)

Numeração das telas = telas do check-list.

| # | Tela | Requisito da reunião | Referência SOC | Situação atual no app | Impacto no schema |
|---|---|---|---|---|---|
| R1 | 2 | **Editar** nome de Setor e Função sem perder os riscos (hoje só dá para excluir, e excluir apaga os riscos) | 220 Setor · 225 Cargo | Só botão ✕ (remove setor/função e tudo abaixo) | Nenhum (só UI); confirmar antes de excluir |
| R2 | 2 | Dados de setor/função vêm da Ficha de Registro, PGR e PCMSO (já cadastrados no SOC antes da visita) | 220 · 225 · §0 | Digitação manual | Guardar códigos SOC (fase de integração) |
| R3 | 3 | "Risco de exposição" passa a ser: **Não informado · Permanente · Eventual · Intermitente** | 192 (TIPO_EXPOSICAO) | `nivel_exposicao` = baixo/médio/alto/avaliar | Novo campo `tipo_exposicao`; migrar/aposentar `nivel_exposicao` |
| R4 | 3 | Novo campo **Tempo de exposição** (hh:mm) | 192 (TEMPO_EXPOSICAO) | — | `tempo_exposicao` "HH:MM" |
| R5 | 3 | Novo campo **Critério**: Qualitativo · Semiquantitativo · Quantitativo | 192 (CRITERIO) | — | `criterio` (enum) |
| R6 | 3 | Novo campo **Fontes ou circunstâncias** | 181 Fontes Geradoras | `fonte_geradora` texto livre (existe no schema) | Lista da tela 181 (+ texto livre) |
| R7 | nova | **Índice medido** sai da Tela 3 e vai para uma **tela nova**, listando Setores → Funções → Riscos já informados | 192 / Medição 204 · planilha 864 aba "Medição" | `indice`, `unidade`, `quantificacao` dentro do risco na Tela 3 | Dados podem ficar no mesmo risco; muda só a tela |
| R8 | 3 | **EPI/EPC por risco** (não por grupo) | 192 · planilha 864 aba "Equipamentos" | Por grupo de risco (schema 1.10.0) | Vincular cada EPI/EPC ao risco (`risco_ref`); **migração** das visitas existentes |
| R9 | nova | **Matriz de Avaliação**: tela nova, por risco de cada função, **só depois** do índice medido | 192 · Matriz 11.13 · PGR 1283 (Severidade × Probabilidade → Nível) | — | `matriz` { linha, coluna, nivel } por risco |
| R10 | 4 | GHE alinhado à **tela 358** | 358 (Descrição do GHE, Detalhada, do Local, das Atividades, Riscos) | Nome, descrição, funções | Campos de descrição do 358 |
| R11 | 5 | Treinamentos: **lista pré-cadastrada** com resposta **obrigatória SIM/NÃO** | Curso 242 / Exporta Dados Treinamento (41.13) | Lista livre + situação por treinamento | Catálogo de treinamentos |
| R12 | 5 | Ao marcar a função, habilitar **data de vencimento** | Turma 251 | — | `funcoes[]: { funcao_ref, vencimento }` |
| R13 | 5 | **Situação por função**, não por treinamento | — | `situacao` no treinamento | Mover `situacao` para cada função |

### Decisões da seção 6 respondidas pela reunião

- **#2 EPI/EPC por agente:** ✅ sim, por risco (R8).
- **#7 Classificação do risco:** ✅ matriz da tela 192 em tela própria (R9); "nível de exposição" vira tipo de exposição (R3).
- **#8 Dados do cargo:** ✅ vêm do cadastro prévio no SOC (R2); em campo o técnico só ajusta.

### Respostas do responsável (04/11/2026)

1. **Matriz → seguir o padrão do Mapa de Riscos (tela 338).** Pelo manual (tópico 100.5): cada risco recebe **Frequência** (linha) e **Classificação de Efeito** (coluna); o **tamanho do círculo** no mapa = soma dos dois valores (4x4: 0–3 Pequeno · 4–5 Médio · 6–8 Grande; 5x5: 0–3 · 4–5 · 6–10); a **cor** = grupo de risco (verde físico, vermelho químico, marrom biológico, amarelo ergonômico, azul acidente).
   - Escalas padrão SOC 4x4 — Efeito: Não se aplica 0 · Leve 1 · Moderado 2 · Sério 3 · Severo 4; Frequência: Não se aplica 0 · Ocasional 1 · Intermitente 2 · Habitual 3 · Permanente 4.
   - Escalas padrão SOC 5x5 — Efeito: Não se aplica 0 · Reversível leve 1 · Reversível severo 2 · Irreversível severo 3 · Fatal ou incapacitante 4 · Altamente catastrófico 5; Frequência: Não se aplica 0 · Altamente improvável 1 · Improvável 2 · Habitual 3 · Provável 4 · Altamente provável 5.
   - ⚠️ No PGR de um cliente real aparecem rótulos **personalizados** ("1 - Lesão leve", "2 - Lesão moderada", "3 - Pouco provável"; níveis "Risco Baixo", "Risco Moderado"; classificação "Aceitável"). Ou seja, a matriz em uso **não é a padrão** — confirmar a configuração em Empresa > Configurar Matriz de Avaliação de Risco `[AGUARDA MATRIZ DE RISCO USADA PELA SELECT]`.
   - A caracterização do risco no SOC (tela 1283 › Detalhes) também traz: Descrição, Possíveis lesões, Fontes ou circunstâncias, Medidas administrativas, **Critério**, **Perfil de exposição**, **Classificação**, **Ações necessárias**, Observações.
2. **Lista de treinamentos:** lista da tela 242 enviada ao técnico; aguardando aprovação para usar `[AGUARDA VALIDAÇÃO]`.
3. **Treinamentos — fluxo definido:**
   - Para cada treinamento da lista, resposta **obrigatória**: *Aplica-se ao cliente?* SIM/NÃO.
   - Se SIM → abre a tela atual: o técnico seleciona Setores/Funções (continuam carregados para seleção) e, **por função**, a situação:
     - **Possui** → campo **data de vencimento**;
     - **Necessita reciclagem** → campo **data sugerida**;
     - **Não possui** → campo **data sugerida**.
4. **Insalubridade, periculosidade e aposentadoria especial:** ✅ incluir no check-list.
5. **Migração das visitas salvas:** apenas análise de viabilidade (ver §7). Nada implementado.

---

## 7. Viabilidade — migração das visitas já salvas (análise, sem implementação)

**Onde estão os dados:** IndexedDB de cada aparelho + Supabase (`visitas.dados`, JSON completo, `auditoria.versao_schema` = 1.10.0).

**Precedente no código:** `migrarRiscosParaFuncao` (src/js/estado.js) já migra visitas antigas (≤1.7.0 → 1.8.0) **ao abrir**, de forma idempotente e sem perda (cria função "Geral"). O mesmo padrão serve aqui.

| Mudança | Conversão automática? | Proposta |
|---|---|---|
| `nivel_exposicao` (baixo/médio/alto) → **tipo de exposição** (Permanente/Eventual/Intermitente) | ❌ Não — medem coisas diferentes (intensidade × frequência) | Novo campo começa como "Não informado"; o valor antigo fica guardado como **legado** (somente leitura) para o técnico consultar |
| EPI/EPC **por grupo** → **por risco** | ⚠️ Parcial | Se o grupo tem **1 risco** na função → vincula direto. Se tem **vários** → vincula a todos os riscos do grupo e marca **"revisar"**. Nada é apagado |
| Treinamento: situação por treinamento → **por função** + "aplica-se" | ✅ Sim | Situação atual copiada para cada função vinculada; "aplica-se = SIM" quando houver funções; datas vazias |
| Índice medido em tela nova | ✅ Sem conversão | Os dados continuam no mesmo risco; muda só a tela |
| Novos campos (tempo, critério, fontes, matriz, insalubridade, GHE 358) | — | Começam vazios |

**Riscos e cuidados:**
- **Visitas concluídas:** migrar ao abrir altera o registro. Com a trilha de auditoria (SST-16) isso deve ficar registrado como "migração de schema", não como edição do técnico. Alternativa: migrar só rascunhos e manter concluídas como estão (somente leitura no formato antigo).
- **Vários aparelhos:** a mesma visita pode estar em versões diferentes em aparelhos diferentes; a migração precisa ser idempotente (como a atual) e o servidor deve aceitar 1.10.0 e 2.0.0 durante a transição.
- **Relatório PDF:** precisa saber ler os dois formatos enquanto houver visitas antigas.

**Conclusão:** **viável sem perda de dados**. O único ponto que exige revisão humana é o EPI de grupos com mais de um risco. Recomendação: subir o schema para **2.0.0** (mudança incompatível) e confirmar com o técnico quantas visitas reais existem antes de decidir entre migrar todas ou só os rascunhos.

---

## 6. Decisões pendentes (Técnico de Segurança / responsável)

1. **Códigos do SOC:** o check-list deve passar a escolher Unidade/Setor/Cargo, Risco e EPI **a partir das listas do SOC** (via Exporta Dados, com intermediário no servidor) em vez de texto livre?
2. **EPI/EPC por agente:** aceitar ligar cada EPI/EPC ao agente de risco (como o SOC exige), e não só ao grupo?
3. **Insalubridade, periculosidade e aposentadoria especial:** o técnico marca em campo ou é definido depois, no laudo?
4. **Data Início Condição e Período de Vigência:** usar a data da visita? Qual versão de PGR informar?
5. **Requisitos NR-06/NR-09 do EPI** (uso ininterrupto, validade do CA, periodicidade de troca, higienização): coletar em campo?
6. **Formato aceito na tela 864:** o modelo é `.xls`; confirmar se o SOC aceita `.xlsx` na importação.
7. **Classificação do risco:** substituir "nível de exposição" por **Severidade × Probabilidade** (matriz do PGR no SOC)? Qual matriz/escala a Select usa?
8. **Dados do cargo e do GHE em campo:** coletar CBO, descrição detalhada das atividades, local, material e mobiliário por função, e descrição do local/atividades por GHE?
9. **Plano de Ação:** o técnico define em campo categoria e responsável de cada não conformidade?
10. **Pré-carregar dados do SOC** (hierarquia, GHEs e riscos já cadastrados) em visitas a clientes recorrentes?

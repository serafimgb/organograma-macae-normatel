Contexto Quero substituir uma planilha Excel atual (Normatel) que gerencia organogramas de projetos (ex.: projetos 741, 743, 736, 737), com listas de colaboradores ativos/desligados/afastados, distribuição por carteira (Civil, Áreas Verdes, Conservação e Limpeza, Elétrica, Mecânica, Logística, SMS, Suprimentos, RH, Compras, Engenharia, etc.) e por base (CABIUNAS, BARRA DO FURADO, FAZENDA SEVERINA, UTE, AE, TAPERA, VAGA UTE).

O Excel hoje tem limites: não dá pra controlar quem vê o quê, não dá pra esconder salário de gerentes intermediários, e qualquer um que abre a planilha vê tudo. Quero um app web próprio.

Construa um app web full-stack com:

Stack sugerida

Frontend: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
Backend: Next.js API routes (ou tRPC) + Prisma ORM
Banco: PostgreSQL (Supabase ou Neon)
Auth: NextAuth/Auth.js com magic link por e-mail + provider Microsoft (Azure AD) opcional
Visualização do organograma: react-flow (nós arrastáveis, conexões hierárquicas)
Deploy alvo: Vercel
Modelo de dados (Prisma)

User (id, email, name, role: ADMIN/MANAGER/VIEWER, createdAt)
Project (id, code ex "743", name, description)
Carteira (id, name, projectId)
Base (id, name, projectId)
Funcao (id, name)
Employee (id, chapa, nome, cpf, funcaoId, projectId, carteiraId, baseId, admissao, demissao, situacao: ATIVO/DESLIGADO/AFASTADO/etc, salary Decimal nullable)
OrgNode (id, projectId, employeeId nullable, parentId nullable, position {x,y}, label) — para o organograma visual
Permission (id, userId, projectId, canViewSalary Boolean, canEdit Boolean, scope: ALL/CARTEIRA/BASE, scopeRefId nullable)
AuditLog (id, userId, action, entityType, entityId, changes Json, createdAt)
Regras de permissão

ADMIN: tudo, em todos os projetos
MANAGER: ver/editar apenas projetos atribuídos via Permission; pode ter canViewSalary=true só em escopos específicos (ex.: ver salário só da carteira CIVIL do projeto 743)
VIEWER: ver, sem editar, sem salário por padrão
Toda query de Employee deve filtrar por permissão antes de retornar. NUNCA retornar salary se canViewSalary=false.
Telas (App Router)

/login — magic link
/projects — cards dos projetos que o usuário tem acesso
/projects/[code]/dashboard — análises (réplica do que existe hoje no Excel):
Indicadores (total ativos, desligados, afastados, headcount líquido)
Headcount por Função (tabela)
Headcount por Carteira (tabela + barra horizontal)
Carteira × Base (matriz)
Movimentação histórica (admissões/desligamentos por ano)
/projects/[code]/organograma — react-flow editável (drag, conectar, criar/remover caixas)
/projects/[code]/efetivo — tabela completa de colaboradores com filtros (situação, carteira, base, função) + busca por nome/chapa. Coluna salário só aparece se permissão permitir.
/admin/users — ADMIN gerencia usuários e permissões (qual projeto, qual escopo, pode ver salário sim/não, pode editar sim/não)
/admin/import — importar planilha Excel (.xlsx) com colaboradores; usar SheetJS (xlsx lib) pra ler e fazer upsert no banco
Funcionalidades-chave

Importação em lote via Excel mantendo a estrutura atual (colunas CHAPA, NOME, FUNÇÃO, CPF, ADMISSÃO, DEMISSÃO, SIT, PROJETO, BASE, CARTEIRA)
Histórico de mudanças (AuditLog) em toda mutação importante
Export pra Excel/PDF do dashboard e do organograma
Dark mode
Responsivo (organograma desktop-only é ok)
Comece criando:

package.json com dependências
prisma/schema.prisma completo
Estrutura de pastas Next.js App Router
Middleware de auth + função requirePermission(userId, projectId, action)
Página /projects/[code]/dashboard mockada com dados fake do projeto 743 (CIVIL 91 ativos, ÁREAS VERDES 81, etc.) só pra eu validar layout
Pergunte antes de assumir coisas que não estão claras (ex.: SSO obrigatório? salário em moeda BRL com formatação? quem cria o primeiro ADMIN?).

Tela /projects/[code]/organograma — editor visual com react-flow, deve permitir:

Edição livre das boxes

Adicionar nova caixa (botão "+" no canvas ou atalho N)
Excluir caixa selecionada (tecla Delete)
Mover caixa arrastando; snap em grade opcional
Redimensionar caixa pelas bordas
Duplicar caixa (Ctrl+D)
Conectar/desconectar caixas com linhas hierárquicas (drag das handles)
Reordenar filhos de um pai (drag-and-drop dentro do mesmo nível)
Desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z) — mínimo 50 passos no histórico
Zoom (scroll), pan (espaço + drag), fit-to-screen, mini-mapa
Conteúdo de cada caixa (OrgNode)

Vincular a um Employee existente OU deixar como vaga em aberto (nome em branco com badge "VAGA")
Campos visíveis no card: nome, função, base, situação (badge colorido)
Cores automáticas por situação: ATIVO=verde, AFASTADO=laranja, DESLIGADO=cinza riscado, VAGA=tracejado amarelo
Salário só aparece se canViewSalary=true para o usuário
Painel lateral de edição (abre ao clicar numa caixa)

Campos editáveis: função, carteira, base, data de admissão, data de demissão, situação, observações
Botão "Vincular colaborador" → busca em Employee com autocomplete (nome ou chapa)
Botão "Marcar como vaga" → desvincula employee, mantém a caixa
Botão "Histórico" → mostra AuditLog dessa caixa (quem alterou, quando, o quê)
Comentários e anotações

Cada OrgNode tem uma lista de Comment (id, nodeId, userId, text, createdAt, resolvedAt nullable)
Ícone de balão na caixa quando há comentários; número indica quantidade
Comentários suportam @menção (notifica usuário por email opcional)
Comentários podem ser marcados como "resolvidos" (somem do contador, ficam no histórico)
Tipos rápidos de comentário com tags: #vaga-urgente, #substituição, #afastamento, #promoção — filtráveis no canvas
Indicadores visuais nas caixas

Badge "AFASTADO desde DD/MM/AAAA" em laranja
Badge "ADMITIDO há X dias" se admissão < 90 dias (verde claro)
Badge "VAGA há X dias" para caixas sem employee vinculado
Ícone de cadeado se a caixa está fora do escopo de permissão do usuário
Filtros e visualizações

Toggle: mostrar/ocultar vagas, afastados, desligados
Filtro por carteira (highlight nas caixas da carteira selecionada, demais ficam opacas)
Filtro por base
Modo "só estrutura" (esconde nomes, mostra só funções) — útil pra apresentação
Modo "com salários" (só ADMIN/permitidos)
Persistência

Salvar automático a cada mudança (debounce 1s) via API
Indicador "Salvando…" / "Salvo às HH:MM"
Versões: snapshot manual com nome (ex.: "Antes da reestruturação Q4") — listar e restaurar
Export

PNG/PDF do canvas inteiro (alta resolução)
JSON da estrutura (backup)
Atualize o schema Prisma:

OrgNode ganha: width Int, height Int, notes String?, customColor String?
Novo: Comment (id, nodeId, userId, text, tags String[], resolvedAt DateTime?, createdAt)
Novo: OrgSnapshot (id, projectId, name, data Json, createdBy, createdAt) — versões do organograma
Implemente o editor com react-flow + zustand pra estado local + tRPC pra persistir mudanças no servidor.
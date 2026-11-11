# Motor próprio de sincronização — etapa 1 (1.5.19)

A reescrita começa pelo Google Drive. O código independente fica em `sync/engine`; não importa classes, algoritmos, armazenamento ou conectores do Floccus. `fast-xml-parser` é uma dependência genérica declarada pelo projeto.

## Disponível

Nas opções de um perfil Google Drive, **Conferir favoritos → Comparar com Google Drive** lê a configuração salva, a pasta local e o arquivo XBEL remoto. A comparação conta itens em comum e presentes apenas de um lado, considerando tipo, nome, URL e caminho. Mantém ocorrências duplicadas e distingue títulos contendo `/` de pastas aninhadas. As contagens incluem pastas e favoritos.

O conector próprio renova a autorização OAuth em memória, pesquisa o arquivo pelo nome com paginação e escapes, baixa o conteúdo e confere tamanho e revisão antes de apresentar o resultado. Não retorna tokens nem o conteúdo dos favoritos para a tela. Respostas da API não entram em mensagens de erro ou logs.

A leitura não modifica favoritos, perfis, cache, mapeamentos ou arquivos do Drive. Não cria arquivos ausentes, não escolhe entre nomes duplicados e não remove arquivos duplicados. A única requisição POST é a renovação do token OAuth; as operações do Drive são GET.

São tratados cancelamento, tempo limite, erros de autorização, limites da API, arquivos duplicados, mudança de revisão remota e alterações locais durante a consulta. XML inválido, DTD, entidades personalizadas, IDs repetidos e formatos não suportados interrompem a comparação. O limite é 20 MB, 100 mil nós e 100 níveis de pastas.

## Limites desta etapa

- A sincronização instalada continua usando o motor atual; nenhum perfil é migrado automaticamente.
- A comparação é um inventário, não um plano executável. Não detecta alterações de ordem, movimentos ou conflitos entre versões.
- Arquivos criptografados e perfis de abas ainda não são suportados por este leitor. A interface informa a limitação sem sugerir remover a criptografia.
- A interface ainda recebe perfis do motor legado; o novo núcleo depende apenas de entradas e APIs explícitas.
- As consultas são iniciadas pelo botão e canceladas ao sair da tela ou alterar o perfil; não há escrita nem execução automática pelo novo motor.

## Próximas etapas

1. Modelo persistente com identidade dos itens, ancestral comum, mapeamentos e alterações de ordem.
2. Reconciliação de três versões, resolução de conflitos e proteções contra exclusões em massa.
3. Escrita condicional no Drive, backup e aplicação local com diário de recuperação.
4. Migração explícita de um perfil, fila, agendamento e retomada após reinício.
5. Validação com contas reais antes de tornar o novo motor padrão.

## Validação

`npm test` cobre o leitor XML, o transporte Google Drive, a comparação e a tela integrada com APIs simuladas. Os testes verificam ausência de escritas, credenciais fora dos resultados, configuração salva em vez de rascunhos, cancelamento e leituras concorrentes. Nenhuma conta Google real foi acessada durante o desenvolvimento.

O roteiro detalhado, com prioridades e critérios de conclusão de cada fase, fica em [PROXIMOS-PASSOS.md](../PROXIMOS-PASSOS.md). A evidência disponível e os testes manuais pendentes ficam em [validacao.md](validacao.md). Não há migração agendada nem ativação automática do novo motor.

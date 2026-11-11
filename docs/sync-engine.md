# Motor próprio Google Drive — 1.6.0

Os perfis **Google Drive com pasta de favoritos** passam a executar o núcleo de `sync/engine` ao usar **Sincronizar**, as ações direcionais ou o agendamento já configurado. O painel de comparação introduzido em 1.5.19 foi removido. As funções de comparação sem escrita permanecem apenas como diagnóstico interno/testes.

Os demais provedores e os perfis de **abas** continuam no motor legado. Cadastro, autenticação interativa, armazenamento dos perfis e a estrutura de agendamento ainda usam a camada de compatibilidade Floccus. O algoritmo de reconciliação, o transporte Drive, a aplicação local e o diário de execução dos perfis atendidos são próprios.

## Fluxo

1. Consultar o perfil salvo, a pasta local e o arquivo remoto.
2. Adquirir um bloqueio remoto temporário com condição de revisão; respeitar os bloqueios ainda ativos de outro dispositivo.
3. Aproveitar o cache/mapeamentos legados na primeira execução, quando consistentes com a pasta. Sem base anterior, mesclar os itens sem inferir exclusões.
4. Reconciliar base confirmada, árvore local e árvore remota, mantendo IDs e ocorrências duplicadas.
5. Persistir o backup e o plano antes de modificar o conteúdo.
6. Gravar o Drive condicionalmente e verificar os bytes retornados.
7. Aplicar operações locais individualmente, registrando o passo pendente antes da API e verificando o resultado antes do próximo checkpoint.
8. Conferir os dois lados, confirmar a nova base e liberar o bloqueio remoto.

Fechar o popup não cancela a execução: ela fica no worker. Se ele for interrompido, o diário permite reconhecer uma gravação remota já concluída e operações locais já aplicadas. Uma criação cujo retorno não foi persistido é identificada pelo resultado exato esperado, sem criar outra cópia. Alterações externas incompatíveis interrompem a recuperação em vez de serem sobrescritas.

## Conflitos, direção e exclusões

Alterações em campos distintos do mesmo item são mescladas. Edição concorrente do mesmo campo, exclusão contra edição, conflito de ordem e ciclos de pastas interrompem o plano antes de sua aplicação. A interface mostra o erro no perfil; o usuário pode ajustar os itens ou escolher **Enviar uma vez / Receber uma vez** nas ações avançadas.

Essas ações direcionais usam o mesmo núcleo. A proteção de exclusão permanece ativa conforme `failsafe`: bloqueia exclusão de todos os itens e exclusões acima de `max(5 itens, 20% da árvore)`. Execução forçada não ignora essa proteção nem um bloqueio remoto ativo.

Pastas sobrepostas entre perfis são recusadas por enquanto, para impedir motores ou perfis diferentes de escreverem na mesma árvore sem um modelo comum de propriedade.

## Formato e concorrência no Drive

O leitor preserva nomes, URLs, IDs, metadados `desc`/`info` e atributos XBEL. O cabeçalho DTD padrão produzido pelo Floccus é tratado como texto inerte e removido antes do parsing: nenhuma DTD é carregada. Declarações de entidades e DTDs não reconhecidas são recusadas.

A criptografia existente é preservada: PBKDF2/SHA-256, 250 mil iterações, AES-GCM com IV de 16 bytes, leitura do envelope JSON `salt`/`ciphertext` e do formato base64 anterior com nome do arquivo como salt. Uma senha incorreta interrompe a operação.

A leitura utiliza a API Drive v3. Escrita e bloqueios usam a revisão `etag` do recurso v2 com `If-Match`; a ausência/rejeição da condição não autoriza gravação incondicional. Novos arquivos recebem um ID pré-gerado persistido no plano, evitando criar outro arquivo após uma resposta perdida. Após gravar, o conteúdo é lido novamente e conferido. Arquivos homônimos não são escolhidos nem excluídos automaticamente.

Referências de protocolo: [files.update v2](https://developers.google.com/drive/api/reference/rest/v2/files/update), [files.patch v2](https://developers.google.com/drive/api/reference/rest/v2/files/patch), [files.generateIds v3](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds) e [criação de arquivos](https://developers.google.com/workspace/drive/api/guides/create-file). O comportamento efetivo com uma conta real continua pendente de validação.

O bloqueio remoto é renovado durante checkpoints longos. A liberação também é tentada após cancelamento; se a rede impedir a limpeza, o bloqueio expira após 15 minutos. O motor nunca libera deliberadamente o bloqueio de outro proprietário.

## Persistência e recuperação

Cada perfil atendido usa `chrome.storage.local["superSync:engine[<id>]"]`:

- `tree`, `mapping`, `highestId`, `fileId`: base confirmada e identidade dos itens.
- `journal`: plano, direção, payload remoto e operação local pendente.
- `migrationBackup`: primeiro snapshot local/remoto desse escopo.
- `backups`: os dois snapshots anteriores mais recentes.
- `history`: até 30 registros resumidos de sucesso, sem credenciais.
- `leaseOwner`: identificador do bloqueio remoto, sem tokens.

Os backups e checkpoints contêm favoritos e ficam no armazenamento local da extensão; o conteúdo remoto mantém a criptografia quando ela já estava habilitada. Eles não são anexados à exportação de perfis. Ainda não existe uma tela de restauração desses backups. Excluir o perfil remove esse estado; **redefinir o cache** descarta o plano/base e mantém os backups, permitindo uma nova mesclagem conservadora. Evite redefinir o cache como primeira resposta a um conflito sem conferir os dados.

O worker retoma diários não cancelados após sua reinicialização. Cancelamento explícito marca a operação pausada. As operações existentes de cadastro e OAuth permanecem; não é preciso recriar um perfil Google Drive para acionar o núcleo próprio.

Mudar pasta, arquivo ou autorização altera o escopo e impede aplicar uma recuperação antiga ao perfil novo. Quando não há operação pendente, o novo escopo inicia com mesclagem conservadora. Bloquear os perfis interrompe novas mutações nos checkpoints.

## Código e compilação

| Arquivo | Responsabilidade |
| --- | --- |
| `tree.cjs` | XBEL e snapshots |
| `model.cjs` | Identidade, reconciliação, ordem e proteção de exclusões |
| `google-drive.cjs` | OAuth em memória, leitura, escrita condicional e bloqueios |
| `crypto.cjs` | Envelope criptográfico compatível e identificação do escopo |
| `local.cjs` | Operações de favoritos e recuperação por checkpoint |
| `runner.cjs` | Planejamento, backup, execução e confirmação |
| `background-entry.js` | Compatibilidade de perfis, comandos, agendamento, status e cancelamento |

Na raiz:

```sh
npm ci
npm run setup:sync
npm run setup:vpn
npm run build:sync-engine
npm run build:sync
npm test
```

`build:sync-engine` recompila `sync/js/background-script.js`; `build:sync` recompila a interface e os estilos. A instalação descompactada usa os arquivos já gerados, sem Node.js.

## Validação e limites

A suíte cobre envio/recebimento, edições concorrentes, movimentação, ordem, exclusões, identidade na migração, arquivos novos, criptografia compatível, dois dispositivos simulados e falhas antes/depois dos checkpoints de armazenamento. O transporte de produção é exercitado contra respostas HTTP simuladas, incluindo precondição rejeitada e limpeza do bloqueio após cancelamento.

Ainda faltam testes com uma conta Google real, interrupção real do worker, volume elevado, restauração por interface e migração dos demais conectores/perfis de abas. Raiz geral do navegador e favoritos gerenciados por política são recusados; selecione uma pasta modificável. Os limites de 20 MB, 100 mil nós e profundidade limitada permanecem. A aplicação local privilegia checkpoints por operação; o desempenho de importações grandes precisa ser medido.

[Validação pendente](validacao.md) · [Roteiro](../PROXIMOS-PASSOS.md)

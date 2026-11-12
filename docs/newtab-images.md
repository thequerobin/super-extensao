# Imagens da Nova guia — 1.6.8

O editor e as configurações de fundos/widgets usam os componentes React compartilhados em `vendor/tabliss-source/src/ui`. A estrutura vem de `ui/catalog.json`, e a aparência de `ui-components.css`. `ProviderAccess` usa os mesmos componentes de campo, descrição, grupo de ações e aviso para Unsplash e GIPHY. A chave e as ações têm espaçamento explícito, inclusive em telas estreitas. Essa mudança preserva o armazenamento e o comportamento dos provedores descritos abaixo.

A distribuição anterior continha `Client-ID undefined` para Unsplash e `api_key=undefined` para GIPHY. Isso fazia os serviços responderem com erro. O código tratava a resposta como imagem, causando as exceções de `.map` e `images.original`, sem encerrar corretamente todos os fluxos de carregamento.

## Configurar

1. Recarregue a extensão em `chrome://extensions` e abra uma nova guia.
2. Abra a engrenagem da Nova guia e selecione o fundo **Unsplash** ou **GIPHY**.
3. Nas opções desse fundo, preencha **Chave de acesso do Unsplash** ou **Chave de API do GIPHY** e clique em **Salvar chave de API**. Os links de documentação ao lado explicam como obter a chave no respectivo serviço.
4. O fundo tenta carregar automaticamente após salvar. Em caso de indisponibilidade, use **Tentar novamente**.

O Unsplash utiliza a Access Key, não a Secret Key. O GIPHY utiliza a API key do aplicativo. Fontes oficiais: [Unsplash](https://unsplash.com/documentation) e [GIPHY](https://developers.giphy.com/docs/api/). Nenhuma chave foi criada ou fornecida por esta correção. Esses provedores continuam dependendo de uma chave válida e da disponibilidade/cota do serviço. Fundos locais, gradientes e imagens próprias continuam disponíveis sem essas chaves.

## Armazenamento e comportamento

- As chaves são salvas em `chrome.storage.local`, em `superNewtab:imageProviders`. Não entram em `tabliss/config`, na exportação/importação da Nova guia ou na sincronização de favoritos.
- Chaves de cliente configuradas na compilação por `.env` continuam sendo aceitas como alternativa; uma chave local tem prioridade.
- Sem chave, não é enviada uma requisição com `undefined`. O painel explica o que configurar.
- Respostas HTTP recusadas, cotas, JSON inválido, listas vazias e imagens ausentes têm tratamento explícito. Mensagens não incluem credenciais nem o corpo bruto da resposta.
- Uma falha ao atualizar mantém a última imagem válida e seus créditos. Novas tentativas não ocorrem continuamente a cada renderização.
- GIPHY evita requisições duplicadas na primeira abertura. Carregamentos de imagens e requisições liberam o indicador ao terminar ou falhar; a exibição de Unsplash aguarda o carregamento da imagem.
- Respostas atrasadas de uma configuração anterior ou de um componente desmontado não substituem o fundo atual. Lotes menores que dez imagens mantêm um cursor válido no cache.
- URLs temporárias de imagens GIPHY são liberadas quando deixam de ser usadas.

O aviso `No tab with id` não explica as respostas inválidas de imagem. No indicador VPN, as atualizações de ícone/título passam a consumir `runtime.lastError` no callback se uma aba fechar durante a operação. Isso evita o aviso nesse caminho; não é uma atribuição de todos os avisos de abas ao indicador sem uma pilha mais específica.

## Recompilar e validar

Na raiz:

```sh
npm ci
npm run setup:newtab
npm run build:newtab
npm run setup:vpn
npm test
```

`build:newtab` recompila a fonte Tabliss e copia os arquivos de execução para `newtab/`, preservando o HTML de integração, seus estilos/scripts e o manifesto principal. A configuração de chaves pela interface dispensa variáveis de ambiente para uso local.

Testes de API e React simulam chave ausente, 401/403/429, resposta inválida, GIPHY sem `original`, imagem válida, falha de bytes, manutenção do cache, revisão das chaves, ausência de repetição por renderização e descarte de respostas antigas. O pacote foi recompilado sem as strings de credenciais `undefined` anteriores. As chamadas reais com chaves de conta e o carregamento visual no navegador ainda precisam de validação.


Na 1.7.18, o estado/configuração e a persistência/cache usados por esses componentes passaram ao núcleo próprio. As chaves e a base de imagens foram preservadas; editor e provedores continuam na camada adaptada. [Escopo da extração](newtab-engine.md).

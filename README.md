# CRM LR Interiores

CRM interno da LR Interiores para organizar clientes, orçamentos, oportunidades comerciais, produção, financeiro, parceiros/comissões e marketing.

> **Importante:** esta documentação descreve o funcionamento observado no código atual. Atualize-a sempre que uma mudança alterar telas, armazenamento, autenticação, segurança ou publicação.

## Módulos do sistema

- **Painel inicial:** resumo de clientes, orçamentos, vendas em andamento e valores recebidos no mês; atalhos para clientes, próximos contatos e prazos de produção.
- **Clientes:** cadastro e pesquisa de clientes, com telefone/WhatsApp, e-mail, origem do contato, endereço e observações.
- **Orçamentos e custos:** cadastro de projetos/orçamentos, vínculo opcional com cliente e estimativa de custos, lucro e margem.
- **Funil de vendas:** acompanhamento das oportunidades comerciais e das etapas de venda.
- **Produção e entregas:** ordens de produção, acompanhamento de projetos, prazos e calendário.
- **Financeiro:** lançamentos financeiros, incluindo despesas/receitas e acompanhamento de pagamentos.
- **Parceiros / Comissões:** cadastro de parceiros, vínculo com orçamentos e controle de comissões. Comissões pagas podem gerar lançamento correspondente no Financeiro.
- **Marketing:** acompanhamento do desempenho dos canais e dos resultados por origem.
- **Backup e segurança (no Painel inicial):** criação/restauração de backup criptografado e alteração da senha de criptografia do CRM.

## Tecnologias e estrutura

O projeto é um site estático, composto por HTML, CSS e JavaScript em módulos, publicado pelo GitHub Pages. Não há etapa de compilação identificada na estrutura atual.

Arquivos principais:

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura das telas, navegação e formulários. |
| `script.js` | Lógica dos módulos, cadastros, cálculos, renderização e interações do CRM. |
| `style.css` | Estilos gerais e estrutura visual. |
| `orcamentos.css` | Estilos de orçamentos. |
| `vendas.css` | Estilos do funil de vendas. |
| `producao.css` | Estilos de produção e entregas. |
| `financeiro.css` | Estilos do Financeiro. |
| `marketing.css` | Estilos de Marketing. |
| `firebase-auth.js` | Login, recuperação da senha de login, fluxo da senha de criptografia, backup e saída. |
| `firebase-data.js` | Integração com Cloud Firestore, sincronização dos registros, criptografia e backup/restauração. |
| `idle-lock.js` | Bloqueio automático após período sem atividade. |

## Login, dados e criptografia

- O login usa **Firebase Authentication**.
- A senha de login e a senha de criptografia são distintas e têm finalidades diferentes.
- Os dados são sincronizados com o **Cloud Firestore** e protegidos por criptografia no código do cliente antes de serem armazenados na nuvem.
- A implementação atual deriva uma chave com PBKDF2/SHA-256 e usa AES-GCM; a senha de criptografia é necessária para desbloquear os dados.
- O código de dados mapeia os conjuntos locais para coleções no Firestore: clientes, orçamentos, financeiro, vendas, produção, parceiros e comissões.
- O bloqueio por inatividade está configurado para aproximadamente 10 minutos; quando é seguro bloquear, a aplicação bloqueia os dados e recarrega a página.
- O projeto oferece backup criptografado com senha própria. **A senha do backup, a senha de login e a senha de criptografia do CRM não devem ser tratadas como a mesma senha.**

### Cuidados essenciais

1. Antes de mudanças no sistema, confirme que o CRM abre e que os dados estão acessíveis.
2. Faça um backup criptografado e confirme que sabe qual senha foi usada para criá-lo.
3. Nunca apague dados do navegador, chaves, coleções ou arquivos de segurança como tentativa de corrigir um problema sem antes entender o impacto e confirmar um backup válido.
4. Nunca altere o fluxo de login, a senha de criptografia, a lógica de sincronização ou a restauração de backup como parte de uma mudança visual comum.
5. Não altere nem remova as chaves de armazenamento ou nomes das coleções sem planejar uma migração compatível com os dados existentes.
6. Não registre senhas, tokens, dados de clientes ou conteúdo de backups neste README, em commits ou em mensagens de erro.
7. O README é documentação: editá-lo não altera, por si só, o comportamento do CRM.

## Como fazer alterações com segurança

Adote mudanças pequenas e isoladas:

1. **Registrar uma versão estável:** conferir a branch e o commit atual antes de editar.
2. **Trabalhar em uma branch separada:** não experimentar diretamente na `main`.
3. **Alterar um escopo por vez:** por exemplo, primeiro um formulário; em outra etapa, integração financeira; depois, navegação.
4. **Revisar o diff:** confirmar que só os arquivos esperados foram alterados.
5. **Testar o fluxo completo afetado:** cadastro, edição, exclusão quando aplicável, atualização da página, sincronização entre navegadores e preservação dos dados.
6. **Testar login e criptografia separadamente:** confirmar que o login funciona, que a senha de criptografia desbloqueia os dados existentes e que o bloqueio por inatividade continua funcionando.
7. **Publicar só depois da validação:** mesclar a mudança revisada à branch publicada.
8. **Ter um caminho de retorno:** guardar o commit estável anterior e não usar restauração de backup como substituto de rollback de código.

### Checklist mínimo antes de publicar

- [ ] A tela de login abre e permite entrar.
- [ ] A senha de criptografia existente desbloqueia os dados.
- [ ] Os registros anteriores continuam presentes.
- [ ] O módulo alterado funciona para criar, editar, pesquisar e atualizar registros, conforme aplicável.
- [ ] O Financeiro e os vínculos com outros módulos continuam coerentes.
- [ ] A sincronização na nuvem informa sucesso e não há erros relevantes no console.
- [ ] O backup criptografado continua disponível.
- [ ] Nenhuma senha ou dado sensível foi incluído no commit.

## Publicação

O repositório é publicado em GitHub Pages:

- **CRM publicado:** https://comerciallrinteriores-max.github.io/crm-lr-interiores/
- **Repositório:** https://github.com/comerciallrinteriores-max/crm-lr-interiores

O site usa arquivos estáticos diretamente do repositório. Alterações na branch configurada para o GitHub Pages podem aparecer no site após o processamento da publicação e do cache. Para mudanças de código, valide primeiro em uma branch separada e só publique depois dos testes.

## Quando atualizar esta documentação

Atualize este README quando forem adicionados ou renomeados módulos, alterados os arquivos principais, modificada a estrutura de armazenamento/sincronização, alteradas regras de autenticação/criptografia/backup ou mudado o processo de publicação.

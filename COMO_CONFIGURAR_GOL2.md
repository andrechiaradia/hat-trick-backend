# 🚀 Como subir o backend de pronúncia na Vercel

Guia passo a passo bem detalhado pra você que não é dev.
**Tempo estimado:** 15-20 minutos.

---

## 📋 Antes de começar

Você precisa ter em mãos:

1. ✅ **Sua chave Azure** (KEY 1 ou KEY 2 do Speech Service)
2. ✅ **Sua região Azure:** `eastus` (que você me passou)
3. ✅ **A pasta `vercel-backend`** com os 3 arquivos que enviei

**Tudo numa frase:** vamos pegar essa pasta, subir num site grátis chamado Vercel, e ele vai gerar uma URL pra gente.

---

## **PASSO 1 — Criar conta na Vercel**

1. Vá em **[vercel.com/signup](https://vercel.com/signup)**
2. Clique em **"Continue with GitHub"** se você tiver conta, ou **"Continue with Email"** se preferir email
   - Recomendo Email pra começar — é mais simples
3. Verifique seu email (link de confirmação)
4. Quando entrar pela primeira vez, ele pode pedir pra "criar uma equipe" — pode pular ou criar uma com seu nome

⚠️ **Não precisa cadastrar cartão de crédito.** Plano gratuito (Hobby) é mais que suficiente.

---

## **PASSO 2 — Compactar a pasta do backend**

1. No seu computador, vá até a pasta `vercel-backend` (a que eu te entreguei)
2. Confira que dentro dela tem:
   - 📁 `api/` (com `pronunciation.js` dentro)
   - 📄 `package.json`
   - 📄 `index.html`
   - 📄 `vercel.json`
3. **Compacte a pasta em um arquivo .zip:**
   - **Mac:** clique com botão direito na pasta → "Comprimir"
   - **Windows:** clique com botão direito → "Enviar para" → "Pasta compactada (zipada)"
4. Vai gerar um arquivo chamado `vercel-backend.zip` (ou similar)

---

## **PASSO 3 — Subir a pasta na Vercel**

Aqui o jeito mais fácil pra leigo é usar o **import via drag-and-drop**:

1. Faça login na Vercel: **[vercel.com/dashboard](https://vercel.com/dashboard)**
2. Clique em **"Add New..." → "Project"** (canto superior direito)
3. Vai aparecer uma tela perguntando "Import Git Repository"
4. **Ignore essa parte** — desça a página e procure por **"Clone Template"** ou role até achar uma opção sem Git
5. Se não achar a opção sem Git, faça o seguinte:

### **Plano B — Usar GitHub (mais robusto)**

Se a Vercel insistir em pedir Git, vamos usar o GitHub:

1. Crie uma conta grátis em [github.com](https://github.com) (se não tiver)
2. No GitHub, clique no **"+"** no topo direito → **"New repository"**
3. Nome do repositório: `hat-trick-backend`
4. Marque **"Public"** (importante!)
5. **Não** marque "Add README"
6. Clique em **"Create repository"**
7. Você vai ver uma tela com instruções. Procure por **"uploading an existing file"** (link no meio da página) → clique
8. Arraste a pasta `vercel-backend` inteira pra lá (ou os arquivos um a um)
9. Clique em **"Commit changes"** no fim da página
10. Volte na Vercel → **"Add New" → "Project"**
11. Agora vai aparecer seu repositório → clique em **"Import"**

---

## **PASSO 4 — Configurar a chave Azure (variáveis de ambiente)**

Esse é o passo mais importante. **A chave NÃO vai dentro do código** — vai num campo seguro:

1. Antes de clicar em "Deploy", role pra baixo até achar **"Environment Variables"**
2. Adicione duas variáveis:

**Variável 1:**
- Name: `AZURE_KEY`
- Value: *(cole sua chave KEY 1 do Azure aqui)*
- Clique em **"Add"**

**Variável 2:**
- Name: `AZURE_REGION`
- Value: `eastus`
- Clique em **"Add"**

3. Agora sim clique em **"Deploy"** (botão grande no fim)

---

## **PASSO 5 — Esperar o deploy (1-2 minutos)**

A Vercel vai mostrar uma animação de fogos quando terminar. ✨

Você vai ver uma tela com:
- ✅ "Congratulations!"
- Um botão **"Continue to Dashboard"**
- Uma URL gerada, tipo: `https://hat-trick-backend-xyz123.vercel.app`

**Copie essa URL inteira e me manda.**

---

## **PASSO 6 — Testar se funcionou**

1. Abra a URL no navegador
2. Você deve ver uma tela preta dizendo **"⚽ Hat Trick Backend"**
3. Se aparecer isso = funcionou! 🎉

Se aparecer erro, me manda print que a gente debugga.

---

## 🚨 Problemas comuns

**"A pasta vercel-backend não tem arquivo .zip / não sei zipar"**
→ Vai direto pelo Plano B (GitHub). Mais fácil pra leigo.

**"Não acho 'Environment Variables' antes do Deploy"**
→ Faz o deploy primeiro. Depois vai em: Project → Settings → Environment Variables → adiciona lá. Depois clica em "Redeploy" no menu de Deployments.

**"Aparece erro 'Module not found'"**
→ Algum arquivo não subiu. Confere se a pasta `api/` foi pra dentro do projeto.

**"O deploy falhou"**
→ Me manda print do erro, eu te ajudo.

---

## 📤 O que fazer depois do deploy

Quando você tiver a URL funcionando (passo 5/6):

1. Me manda a URL (algo tipo `https://hat-trick-backend-xyz.vercel.app`)
2. Eu vou colocar essa URL no HTML do Gol 02
3. Te entrego o quiz completo

Pronto! Aí o aluno fala no microfone → seu backend chama a Azure → Azure devolve o score → quiz mostra colorido.

---

🏆 **Hat Trick Challenge** · English Pass

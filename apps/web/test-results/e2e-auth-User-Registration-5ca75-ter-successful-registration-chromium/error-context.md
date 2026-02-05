# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Criar Conta" [level=3] [ref=e5]
      - paragraph [ref=e6]: Comece seu trial gratuito de 7 dias
    - generic [ref=e8]:
      - generic [ref=e9]:
        - text: Nome Completo
        - textbox "Nome Completo" [ref=e10]:
          - /placeholder: João Silva
      - generic [ref=e11]:
        - text: Email
        - textbox "Email" [ref=e12]:
          - /placeholder: seu@email.com
      - generic [ref=e13]:
        - text: Senha
        - textbox "Senha" [ref=e14]:
          - /placeholder: ••••••••
        - paragraph [ref=e15]: Mínimo 8 caracteres, com maiúscula, minúscula e número
      - generic [ref=e16]:
        - text: Nome da Empresa
        - textbox "Nome da Empresa" [ref=e17]:
          - /placeholder: Minha Empresa
      - button "Criar Conta Grátis" [ref=e18]
      - paragraph [ref=e19]:
        - text: Já tem uma conta?
        - link "Entrar" [ref=e20] [cursor=pointer]:
          - /url: /login
  - region "Notifications alt+T"
```
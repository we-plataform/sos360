# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Entrar na Lia 360" [level=3] [ref=e5]
      - paragraph [ref=e6]: Digite suas credenciais para acessar sua conta
    - generic [ref=e8]:
      - generic [ref=e9]:
        - text: Email
        - textbox "Email" [ref=e10]:
          - /placeholder: seu@email.com
      - generic [ref=e11]:
        - text: Senha
        - textbox "Senha" [ref=e12]:
          - /placeholder: ••••••••
      - button "Entrar" [ref=e13]
      - paragraph [ref=e14]:
        - text: Não tem uma conta?
        - link "Criar conta" [ref=e15] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
```
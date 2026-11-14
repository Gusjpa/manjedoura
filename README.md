# Manjedoura Remote

Controle remoto do iPhone para TV Samsung Tizen via Wi-Fi.

```
iPhone (Safari/PWA)  --WebSocket-->  Relay (Node, sua rede)  --WebSocket-->  App Tizen na TV
```

> O app oficial de controle remoto da Apple não controla TV Samsung, e um app Tizen não consegue
> abrir servidor. Por isso o relay: a TV conecta nele como cliente, e o celular também.

## 1. Relay
```bash
cd server && npm install && npm start
```
Ele imprime o endereço (ex.: `http://192.168.0.10:8080`). Rode em um PC, Raspberry Pi ou NAS sempre ligado,
na mesma rede da TV e do iPhone.

## 2. App da TV
1. Edite `tv-app/config.js` com o IP do relay (`ws://IP:8080`).
2. Adicione um `icon.png` (117x117) em `tv-app/`.
3. Tizen Studio: ative o **Modo Desenvolvedor** na TV (Apps → digite 12345 → ON, informe o IP do seu PC),
   conecte pelo Device Manager e execute com *Run As → Tizen Web Application*.
   Alternativa: `tizen package -t wgt -- tv-app` e instale com `tizen install`.
4. A TV exibirá um **código de 4 dígitos**.

## 3. iPhone
Abra `http://IP:8080` no Safari, digite o código e use *Compartilhar → Adicionar à Tela de Início*.

## Teclas
Setas, OK, Voltar, Home, Menu, Vol +/-, Mudo, Play/Pause/FF/REW, 0-9 e envio de texto.
O app também reage às teclas do controle físico. A lógica fica em `handle()` em `tv-app/js/main.js`:
é lá que você liga os comandos às telas/player do seu app.

## Segurança
Sem TLS e protegido apenas pelo código de 4 dígitos: use somente em rede local confiável.

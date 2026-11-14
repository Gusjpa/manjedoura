(function () {
  var $ = function (id) { return document.getElementById(id); };
  var RELAY = (window.APP_CONFIG || {}).RELAY_URL;
  var KEYCODE = { UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, OK: 13, BACK: 10009 };
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.tile'));
  var COLS = 3;
  var ws, retry = 0, savedCode = null;
  try { savedCode = localStorage.getItem('code'); } catch (e) {}

  function showCmd(text) { $('last').textContent = text; }

  // --- registra teclas de mídia/numéricas do controle físico ---
  try {
    var names = ['MediaPlay', 'MediaPause', 'MediaFastForward', 'MediaRewind', 'MediaStop',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'VolumeUp', 'VolumeDown', 'VolumeMute'];
    names.forEach(function (n) { try { tizen.tvinputdevice.registerKey(n); } catch (e) {} });
  } catch (e) { /* fora da TV (navegador): ignora */ }

  // --- navegação por foco ---
  function focusIdx() { var i = tiles.indexOf(document.activeElement); return i < 0 ? 0 : i; }
  function move(d) {
    var i = focusIdx(), n = i;
    if (d === 'LEFT') n = i % COLS ? i - 1 : i;
    if (d === 'RIGHT') n = (i % COLS < COLS - 1 && i + 1 < tiles.length) ? i + 1 : i;
    if (d === 'UP') n = i - COLS >= 0 ? i - COLS : i;
    if (d === 'DOWN') n = i + COLS < tiles.length ? i + COLS : i;
    tiles[n].focus();
  }

  // Aplica um comando lógico, vindo do celular ou do controle físico.
  function handle(key, source) {
    showCmd(key + ' (' + source + ')');
    if (/^(UP|DOWN|LEFT|RIGHT)$/.test(key)) move(key);
    else if (key === 'OK') tiles[focusIdx()].click();
    else if (key === 'BACK') {
      try { tizen.application.getCurrentApplication().exit(); } catch (e) { showCmd('BACK'); }
    } else if (key === 'HOME') tiles[0].focus();
    else if (key === 'VOL_UP' || key === 'VOL_DOWN' || key === 'MUTE') volume(key);
    else if (/^[0-9]$/.test(key)) showCmd('Número ' + key);
    // PLAY/PAUSE/FF/REW/MENU: ligue aqui ao seu player/ação
  }

  function volume(key) {
    // Tizen TV: volume do sistema via tizen.tvaudiocontrol (se disponível)
    try {
      if (key === 'VOL_UP') tizen.tvaudiocontrol.setVolumeUp();
      else if (key === 'VOL_DOWN') tizen.tvaudiocontrol.setVolumeDown();
      else tizen.tvaudiocontrol.setMute(!tizen.tvaudiocontrol.isMute());
    } catch (e) { $('volume').textContent = 'Volume indisponível neste ambiente'; }
  }

  // Teclas do controle físico
  document.addEventListener('keydown', function (e) {
    var map = { 37: 'LEFT', 38: 'UP', 39: 'RIGHT', 40: 'DOWN', 13: 'OK', 10009: 'BACK',
      415: 'PLAY', 19: 'PAUSE', 417: 'FF', 412: 'REW' };
    var k = map[e.keyCode];
    if (!k && e.keyCode >= 48 && e.keyCode <= 57) k = String(e.keyCode - 48);
    if (k) { e.preventDefault(); handle(k, 'controle'); }
  });
  tiles.forEach(function (t) { t.addEventListener('click', function () { showCmd('Selecionado: ' + t.textContent); }); });

  // --- conexão com o relay ---
  function setConn(on, text) { var c = $('conn'); c.className = on ? 'on' : 'off'; c.textContent = text; }
  function connect() {
    ws = new WebSocket(RELAY);
    ws.onopen = function () {
      retry = 0; setConn(true, 'Relay conectado');
      ws.send(JSON.stringify({ type: 'tv-register', code: savedCode }));
    };
    ws.onmessage = function (e) {
      var m = JSON.parse(e.data);
      if (m.type === 'registered') {
        savedCode = m.code; try { localStorage.setItem('code', m.code); } catch (x) {}
        $('code').textContent = m.code;
        $('hint').textContent = RELAY.replace('ws://', 'http://');
      } else if (m.type === 'phone-joined') { setConn(true, 'Celular conectado'); }
      else if (m.type === 'key') handle(m.key, 'celular');
      else if (m.type === 'text') showCmd('Texto: ' + m.text);
    };
    ws.onclose = function () {
      setConn(false, 'Reconectando…');
      setTimeout(connect, Math.min(10000, 1000 * Math.pow(2, retry++)));
    };
    ws.onerror = function () { ws.close(); };
  }
  tiles[0].focus();
  connect();
})();

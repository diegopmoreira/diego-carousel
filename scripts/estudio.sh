#!/bin/zsh -l
# Liga, desliga e cuida do estúdio de carrosséis. Usado pelo app "Carrosséis" (scripts/build-mac-app.sh)
# e também direto do terminal: scripts/estudio.sh start|stop|status|open|update|doctor|report|log|folder|login
set -u
ROOT="${0:A:h:h}"
PORT=4321
URL="http://127.0.0.1:$PORT"
LOGDIR="$HOME/Library/Logs/DiegoCarousel"
LOG="$LOGDIR/estudio.log"
mkdir -p "$LOGDIR"
cd "$ROOT" || exit 1

stamp(){ print -r -- "$(date '+%Y-%m-%d %H:%M:%S') [$1] $2" >> "$LOG"; }
pids(){ lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null; }
running(){ [[ -n "$(pids)" ]]; }
answering(){ [[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/" 2>/dev/null)" == 200 ]]; }

start(){
  if running; then echo "O estúdio já está ligado em $URL"; return 0; fi
  stamp APP "Ligando o estúdio"
  nohup npm run -s preview >> "$LOG" 2>&1 &
  for _ in {1..40}; do answering && break; sleep 0.5; done
  if answering; then stamp APP "Estúdio no ar em $URL"; echo "Estúdio ligado em $URL"
  else stamp APP "O estúdio não respondeu em 20 s"; echo "O estúdio não subiu. Usa \"Copiar relatório de erro\" e manda para o Claude."; return 1; fi
}
stop(){
  if ! running; then echo "O estúdio já estava desligado"; return 0; fi
  pids | xargs kill 2>/dev/null
  for _ in {1..20}; do running || break; sleep 0.25; done
  running && pids | xargs kill -9 2>/dev/null
  stamp APP "Estúdio desligado"; echo "Estúdio desligado"
}
update(){
  local was=0; running && was=1 && stop >/dev/null
  stamp APP "Atualizando (git pull + npm ci)"
  { git pull --ff-only && npm ci; } >> "$LOG" 2>&1
  local rc=$?
  (( was )) && start >/dev/null
  if (( rc == 0 )); then stamp APP "Atualizado: $(git log --oneline -1)"; echo "Sistema atualizado: $(git log --oneline -1)"
  else stamp APP "Falha na atualização (código $rc)"; echo "A atualização falhou. Usa \"Copiar relatório de erro\" e manda para o Claude."; return 1; fi
}
doctor(){ npm run -s carousel -- doctor 2>&1 | tee -a "$LOG" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s);console.log((r.passed?"Tudo certo":"Há problemas")+"\n\n"+r.checks.map(c=>(c.ok?"✓ ":c.optional?"○ ":"✗ ")+c.check).join("\n"));}catch{console.log(s.slice(0,1500));}});'; }
# Tudo o que o Claude precisa para entender um erro, na área de transferência e num arquivo na Mesa.
report(){
  local out="$HOME/Desktop/relatorio-carrossel.txt" latest
  latest=$(ls -td "$ROOT"/projects/*/ 2>/dev/null | head -1)
  {
    print "Relatório do estúdio de carrosséis — $(date '+%Y-%m-%d %H:%M')"
    print "Versão: $(git log --oneline -1)  · estúdio: $(running && echo ligado || echo desligado)"
    print "\n== Diagnóstico =="; doctor 2>&1
    print "\n== Log do estúdio (últimas 120 linhas) =="; tail -n 120 "$LOG" 2>/dev/null
    if [[ -n "$latest" ]]; then
      print "\n== Projeto mais recente: ${latest:t} =="
      print "-- run.log"; tail -n 40 "$latest/run.log" 2>/dev/null
      print "-- agente"; tail -n 60 "$latest/qa/agent.log" 2>/dev/null
    fi
  } > "$out" 2>&1
  pbcopy < "$out"
  echo "Relatório copiado. Cola no chat do Claude (Cmd+V). Também ficou salvo na Mesa: relatorio-carrossel.txt"
}

case "${1:-status}" in
  start) start; running && open "$URL";;
  stop) stop;;
  toggle) if running; then stop; else start && open "$URL"; fi;;
  status) running && echo "ligado" || echo "desligado";;
  open) if running; then open "$URL"; else start && open "$URL"; fi;;
  update) update;;
  doctor) doctor;;
  report) report;;
  log) touch "$LOG"; open -e "$LOG";;
  folder) mkdir -p "$ROOT/projects"; open "$ROOT/projects";;
  login) osascript -e 'tell application "Terminal" to activate' -e "tell application \"Terminal\" to do script \"cd '$ROOT' && echo 'Digite /login, entre na tua conta e depois /exit' && claude\"" >/dev/null; echo "Abri o Terminal com o Claude: digita /login e depois /exit";;
  *) echo "Uso: $0 start|stop|toggle|status|open|update|doctor|report|log|folder|login"; exit 2;;
esac

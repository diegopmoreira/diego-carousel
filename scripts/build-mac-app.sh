#!/bin/zsh
# Gera o app "Carrosséis" (~/Applications/Carrosséis.app): um clique liga/desliga o estúdio e mostra os atalhos.
# Arrasta o app para o Dock. Rodar de novo depois de mover a pasta do projeto.
set -euo pipefail
ROOT="${0:A:h:h}"
APP="${1:-$HOME/Applications/Carrosséis.app}"
CTL="$ROOT/scripts/estudio.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
chmod +x "$CTL"
mkdir -p "${APP:h}"

cat > "$TMP/app.applescript" <<APPLESCRIPT
property ctl : "$CTL"

on run_ctl(cmd)
	try
		return do shell script "/bin/zsh -l " & quoted form of ctl & " " & cmd
	on error errText
		return "Erro: " & errText & return & return & "Usa \"Copiar relatório de erro\" e manda para o Claude."
	end try
end run_ctl

on show(msg)
	display dialog msg buttons {"OK"} default button "OK" with title "Carrosséis" with icon note
end show

on run
	repeat
		set isOn to (run_ctl("status") is "ligado")
		if isOn then
			set header to "Estúdio LIGADO em http://127.0.0.1:4321"
			set toggleItem to "⏻  Desligar o estúdio"
		else
			set header to "Estúdio desligado"
			set toggleItem to "⏻  Ligar o estúdio e abrir"
		end if
		set menuItems to {toggleItem, "🌐  Abrir o estúdio no navegador", "📁  Abrir a pasta dos carrosséis", "⬇️  Atualizar o sistema", "🩺  Diagnóstico", "📋  Copiar relatório de erro (para o Claude)", "📄  Ver o log", "🔑  Renovar o login do Claude", "Sair"}
		set choice to choose from list menuItems with title "Carrosséis" with prompt header default items {item 1 of menuItems} OK button name "Executar" cancel button name "Fechar"
		if choice is false then exit repeat
		set c to item 1 of choice
		if c is "Sair" then exit repeat
		if c is toggleItem then
			show(run_ctl("toggle"))
		else if c starts with "🌐" then
			run_ctl("open")
			exit repeat
		else if c starts with "📁" then
			run_ctl("folder")
		else if c starts with "⬇️" then
			show(run_ctl("update"))
		else if c starts with "🩺" then
			show(run_ctl("doctor"))
		else if c starts with "📋" then
			show(run_ctl("report"))
		else if c starts with "📄" then
			run_ctl("log")
		else if c starts with "🔑" then
			show(run_ctl("login"))
		end if
	end repeat
end run
APPLESCRIPT

rm -rf "$APP"
osacompile -o "$APP" "$TMP/app.applescript"

# Ícone a partir do avatar de Diego.
AVATAR="$ROOT/design/brand/avatar.png"
if [[ -f "$AVATAR" ]]; then
  ICONSET="$TMP/icon.iconset"; mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    sips -z $s $s "$AVATAR" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) "$AVATAR" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/applet.icns"
fi
# Assinatura local (ad hoc) depois de trocar o ícone, para o macOS abrir sem reclamar.
codesign --force --deep -s - "$APP" 2>/dev/null || true
echo "App criado: $APP"

import uuid
from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'uma_senha_muito_secreta_para_a_clinica'
socketio = SocketIO(app, cors_allowed_origins="*")

# --- BANCO DE DADOS DE LICENÇAS VENDIDAS ---
# Sempre que vender o jogo, você adiciona uma linha aqui com um código único
LICENCAS_ATIVAS = {
    "meu-acesso-vip": "Sr. Rodrigo (Proprietário)",
    "licenca-dra-ana-xyz": "Dra. Ana (Cliente 1)",
    "licenca-dr-carlos-abc": "Dr. Carlos (Cliente 2)"
}

salas = {}


@app.route('/')
def index():
    # Agora a página inicial não deixa qualquer um criar sala
    return "Bem-vindo(a) a Casa Terapêutica Online - Travessias Infantis. Acesso restrito a terapeutas licenciados."


# Rota Única do Terapeuta (O link que você vai vender)
@app.route('/terapeuta/<id_licenca>')
def painel_terapeuta(id_licenca):
    if id_licenca not in LICENCAS_ATIVAS:
        return "Acesso Negado: Licença não encontrada ou expirada.", 403

    nome_terapeuta = LICENCAS_ATIVAS[id_licenca]
    return render_template('inicio.html', id_licenca=id_licenca, nome_terapeuta=nome_terapeuta)


@app.route('/criar_sessao/<id_licenca>')
def criar_sessao(id_licenca):
    if id_licenca not in LICENCAS_ATIVAS:
        return "Acesso Negado.", 403

    codigo_unico = str(uuid.uuid4())[:8]
    id_sala = f"TravessiasInfantis-{codigo_unico}"

    salas[id_sala] = {"estado_tabuleiro": []}
    return redirect(url_for('sessao', id_sala=id_sala, tipo='anfitriao'))


@app.route('/sessao/<id_sala>')
def sessao(id_sala):
    if id_sala not in salas:
        return "A sessão foi encerrada pelo terapeuta.", 404
    tipo = request.args.get('tipo', 'convidado')
    return render_template('index.html', id_sala=id_sala, tipo=tipo)


# --- EVENTOS DE TEMPO REAL (WebSockets) ---
# ... (mantenha o resto do seu código servidor.py exatamente igual a partir daqui)


# --- EVENTOS DE TEMPO REAL (WebSockets) ---
@socketio.on('entrar_na_sala')
def on_join(dados):
    sala = dados['sala']
    join_room(sala)
    # Assim que o paciente entra, o servidor envia como estão os móveis no momento
    emit('atualizar_tabuleiro', salas[sala]['estado_tabuleiro'])


@socketio.on('movimento_realizado')
def on_movimento(dados):
    sala = dados['sala']
    # Atualiza a memória do servidor
    salas[sala]['estado_tabuleiro'] = dados['estado']
    # Repassa o movimento para o outro computador na mesma sala
    emit('atualizar_tabuleiro', dados['estado'], room=sala, include_self=False)


@socketio.on('encerrar_sessao')
def on_encerrar_sessao(dados):
    sala = dados['sala']
    if sala in salas:
        # Avisa todos na sala que a sessão acabou
        emit('sessao_encerrada', room=sala)
        # Apaga a sala da memória do servidor
        del salas[sala]


if __name__ == '__main__':
    print("Iniciando o servidor da Clínica...")
    print("Acesse no navegador: http://localhost:5000")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
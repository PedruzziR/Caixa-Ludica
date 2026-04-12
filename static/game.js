// =======================================================
// 1. INICIALIZAÇÃO DA TELA E CONSTANTES
// =======================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const LARGURA_V = 1920;
const ALTURA_V = 1080;
canvas.width = LARGURA_V;
canvas.height = ALTURA_V;

const TAMANHO_COMODO = [450, 450];
const TAMANHO_PLANTA = [150, 150];
const TAMANHO_BAU = 150;
const TAMANHO_PONTO_CONTROLE = 16;
const ESPESSURA_PAREDE = 16;

const ALTURA_BAU = 225;
const Y_BAU = ALTURA_V - ALTURA_BAU;
const ALTURA_CENARIO = ALTURA_V - ALTURA_BAU;

const col_w = LARGURA_V / 3;
const row_h = ALTURA_CENARIO / 2;

const COR_BORDA = '#a06e32';
const COR_TEXTO = '#3c2814';
const COR_BOTAO_ATIVO = '#f5deb3';

// =======================================================
// 2. QUADRANTES E ESTADO GLOBAL
// =======================================================
const quadrantes = {
    "Quarto 1": { x: 0, y: 0, w: col_w, h: row_h, cor: 'rgb(216, 191, 216)', arquivo: 'fundo_quarto_pais' },
    "Quarto 2": { x: col_w, y: 0, w: col_w, h: row_h, cor: 'rgb(175, 238, 238)', arquivo: 'fundo_meu_quarto' },
    "Banheiro": { x: col_w * 2, y: 0, w: col_w, h: row_h, cor: 'rgb(224, 255, 255)', arquivo: 'fundo_banheiro' },
    "Jardim":   { x: 0, y: row_h, w: col_w, h: row_h, cor: 'rgb(152, 251, 152)', arquivo: 'fundo_jardim' },
    "Sala":     { x: col_w, y: row_h, w: col_w, h: row_h, cor: 'rgb(255, 228, 196)', arquivo: 'fundo_sala' },
    "Cozinha":  { x: col_w * 2, y: row_h, w: col_w, h: row_h, cor: 'rgb(255, 250, 205)', arquivo: 'fundo_cozinha' }
};

for (const [nome, quad] of Object.entries(quadrantes)) {
    quad.img = new Image();
    quad.img.src = `/static/assets/${quad.arquivo}.png`;
}

const imgFundoBau = new Image();
imgFundoBau.src = '/static/assets/fundo_bau.png';

let abaAtual = "Casa Inteira";
let listaMiniaturasCena = [];

let itemArrastado = null;
let itemSelecionado = null;
let itemRedimensionando = null;
let itemRotacionando = null;
let pontoControleAtivo = null;
let offsetAnguloMouse = 0;
let posAncoraTela = {x: 0, y: 0};
let propX = 0.5;
let propY = 0.5;

// =======================================================
// 3. CLASSE MINIATURA
// =======================================================
class MiniaturaCena {
    constructor(nome, img, proporcaoAspecto, comodoInicial, xLocal, yLocal) {
        this.nome = nome; // Guarda o nome do objeto para enviar pela internet
        this.img = img;
        this.proporcaoAspecto = proporcaoAspecto;
        this.comodo = comodoInicial;
        this.xLocal = xLocal;
        this.yLocal = yLocal;
        this.escalaManual = 1.0;
        this.viradoHorizontalmente = false;
        this.angulo = 0;
        this.travado = false;
    }

    copiar() {
        const nova = new MiniaturaCena(this.nome, this.img, this.proporcaoAspecto, this.comodo, this.xLocal + 45, this.yLocal + 45);
        nova.escalaManual = this.escalaManual;
        nova.viradoHorizontalmente = this.viradoHorizontalmente;
        nova.angulo = this.angulo;
        nova.travado = this.travado;
        return nova;
    }

    calcularTamanhoBase(aba) {
        const largBase = (aba === "Casa Inteira") ? TAMANHO_PLANTA[0] : TAMANHO_COMODO[0];
        const largura = largBase * this.escalaManual;
        const altura = largura / this.proporcaoAspecto;
        return [largura, altura];
    }

    calcularTamanhoRotacionado(aba) {
        const [w, h] = this.calcularTamanhoBase(aba);
        if (this.angulo !== 0) {
            const rad = this.angulo * Math.PI / 180;
            const newW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
            const newH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
            return [newW, newH];
        }
        return [w, h];
    }

    obterRectTela(aba) {
        const [largura, altura] = this.calcularTamanhoRotacionado(aba);

        if (aba === "Casa Inteira") {
            const quad = quadrantes[this.comodo];
            const [larguraComodo, alturaComodo] = this.calcularTamanhoRotacionado(this.comodo);

            const centroXLocal = this.xLocal + (larguraComodo / 2);
            const centroYLocal = this.yLocal + (alturaComodo / 2);

            const centroXGlobal = quad.x + (centroXLocal * (quad.w / LARGURA_V));
            const centroYGlobal = quad.y + (centroYLocal * (quad.h / ALTURA_CENARIO));

            return {
                x: centroXGlobal - (largura / 2),
                y: centroYGlobal - (altura / 2),
                w: largura,
                h: altura
            };
        } else if (aba === this.comodo) {
            return { x: this.xLocal, y: this.yLocal, w: largura, h: altura };
        }
        return { x: -100, y: -100, w: 0, h: 0 };
    }

    obterRectsPontosControle(aba) {
        const rect = this.obterRectTela(aba);
        if (rect.w === 0) return {};
        const ps = TAMANHO_PONTO_CONTROLE;
        return {
            "top_left": { x: rect.x - ps/2, y: rect.y - ps/2, w: ps, h: ps },
            "top_right": { x: rect.x + rect.w - ps/2, y: rect.y - ps/2, w: ps, h: ps },
            "bottom_left": { x: rect.x - ps/2, y: rect.y + rect.h - ps/2, w: ps, h: ps },
            "bottom_right": { x: rect.x + rect.w - ps/2, y: rect.y + rect.h - ps/2, w: ps, h: ps }
        };
    }

    desenhar(ctx, aba) {
        const rect = this.obterRectTela(aba);
        if (rect.w > 0 && rect.h > 0) {
            const [baseW, baseH] = this.calcularTamanhoBase(aba);
            ctx.save();
            ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
            if (this.angulo !== 0) ctx.rotate(-this.angulo * Math.PI / 180);
            if (this.viradoHorizontalmente) ctx.scale(-1, 1);
            ctx.drawImage(this.img, -baseW / 2, -baseH / 2, baseW, baseH);
            ctx.restore();
        }
    }
}

// =======================================================
// 4. MULTIPLAYER (Socket.IO)
// =======================================================
const socket = io();

// Atualiza a tela de todos quando recebemos um movimento do servidor
socket.on('atualizar_tabuleiro', (estado) => {
    listaMiniaturasCena = estado.map(d => {
        const bauItem = itensBau.find(i => i.nome === d.nome);
        if(!bauItem) return null;

        const m = new MiniaturaCena(d.nome, bauItem.img, bauItem.proporcao, d.comodo, d.xLocal, d.yLocal);
        m.escalaManual = d.escalaManual;
        m.viradoHorizontalmente = d.viradoHorizontalmente;
        m.angulo = d.angulo;
        m.travado = d.travado;
        return m;
    }).filter(i => i !== null);

    // Solta os itens para não dar conflito visual
    itemArrastado = null;
    itemSelecionado = null;
    itemRedimensionando = null;
    itemRotacionando = null;
});

// Ouve a ordem do servidor para encerrar a sessão
socket.on('sessao_encerrada', () => {
    if (TIPO_USUARIO === 'convidado') {
        document.body.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #1e272e; color: white; font-family: Arial;">
                <img src="/static/assets/logo.jpg" style="width: 150px; border-radius: 50%; border: 3px solid #a06e32; margin-bottom: 20px;">
                <h1>Sessão Encerrada</h1>
                <p>O terapeuta encerrou a sessão de hoje. Até a próxima!</p>
            </div>
        `;
    } else {
        window.location.href = '/';
    }
});

// Envia a arrumação atual para o servidor
function sincronizarServidor() {
    const estado = listaMiniaturasCena.map(item => ({
        nome: item.nome,
        comodo: item.comodo,
        xLocal: item.xLocal,
        yLocal: item.yLocal,
        escalaManual: item.escalaManual,
        viradoHorizontalmente: item.viradoHorizontalmente,
        angulo: item.angulo,
        travado: item.travado
    }));
    socket.emit('movimento_realizado', { sala: SALA_ID, estado: estado });
}

// =======================================================
// 5. CARREGAMENTO DO BAÚ (COM CATEGORIAS E ABAS)
// =======================================================
// Catálogo Inteligente: Lista completa atualizada com os novos arquivos
const configItens = [
    // --- PESSOAS ---
    { nome: "bebe", cat: "Pessoas" }, { nome: "bebe1", cat: "Pessoas" }, 
    { nome: "crianca", cat: "Pessoas" }, { nome: "crianca1", cat: "Pessoas" },
    { nome: "homem", cat: "Pessoas" }, { nome: "homem1", cat: "Pessoas" }, 
    { nome: "mulher", cat: "Pessoas" }, { nome: "mulher1", cat: "Pessoas" },
    { nome: "vovo", cat: "Pessoas" }, { nome: "vovo1", cat: "Pessoas" },
    
    // --- MÓVEIS ---
    { nome: "banheira", cat: "Móveis" }, { nome: "bau", cat: "Móveis" },
    { nome: "berco", cat: "Móveis" }, { nome: "cadeira", cat: "Móveis" }, { nome: "cadeira1", cat: "Móveis" },
    { nome: "cama", cat: "Móveis" }, { nome: "cama1", cat: "Móveis" }, { nome: "cama2", cat: "Móveis" },
    { nome: "estante", cat: "Móveis" }, { nome: "mesa", cat: "Móveis" }, 
    { nome: "mesa_de_trabalho", cat: "Móveis" }, { nome: "mesa_jantar", cat: "Móveis" },
    { nome: "pia", cat: "Móveis" }, { nome: "poltrona", cat: "Móveis" }, { nome: "poltrona2", cat: "Móveis" },
    { nome: "sanitario", cat: "Móveis" }, { nome: "sofa", cat: "Móveis" }, { nome: "sofa1", cat: "Móveis" },
    
    // --- ANIMAIS (Muitas novidades aqui!) ---
    { nome: "cao", cat: "Animais" }, { nome: "gato", cat: "Animais" },
    { nome: "capivara", cat: "Animais" }, { nome: "capivara1", cat: "Animais" }, { nome: "capivara2", cat: "Animais" },
    { nome: "cobra", cat: "Animais" }, { nome: "cobra1", cat: "Animais" },
    { nome: "coelho", cat: "Animais" }, { nome: "coelho1", cat: "Animais" }, { nome: "coelho2", cat: "Animais" },
    { nome: "galinha", cat: "Animais" }, { nome: "galinha1", cat: "Animais" }, { nome: "galinha2", cat: "Animais" },
    { nome: "passaro", cat: "Animais" }, { nome: "passaro1", cat: "Animais" }, { nome: "passaro2", cat: "Animais" }, { nome: "passaro3", cat: "Animais" },

    // --- ELETROS E TECH ---
    { nome: "geladeira", cat: "Eletros" }, { nome: "geladeira1", cat: "Eletros" }, { nome: "geladeira2", cat: "Eletros" },
    { nome: "tv", cat: "Eletros" }, { nome: "celular", cat: "Eletros" }, { nome: "celular1", cat: "Eletros" },
    { nome: "tablet", cat: "Eletros" }, { nome: "tablet1", cat: "Eletros" }, { nome: "videogame", cat: "Eletros" },
    
    // --- FERRAMENTAS E LIMPEZA ---
    { nome: "facao", cat: "Ferramentas" }, { nome: "foice", cat: "Ferramentas" }, 
    { nome: "machado", cat: "Ferramentas" },
    { nome: "picareta", cat: "Ferramentas" }, { nome: "vassoura", cat: "Ferramentas" }, { nome: "vassoura1", cat: "Ferramentas" },
    { nome: "balde", cat: "Ferramentas" }, { nome: "bacia", cat: "Ferramentas" },

    // --- OUTROS ---
    { nome: "boneca", cat: "Outros" }, { nome: "boneca1", cat: "Outros" }, { nome: "piano", cat: "Outros" },
    { nome: "pelucia", cat: "Outros" }, { nome: "pelucia1", cat: "Outros" },
    { nome: "plantas", cat: "Outros" }, { nome: "plantas1", cat: "Outros" },
    { nome: "esponja", cat: "Outros" }, { nome: "esponja1", cat: "Outros" }
];

const categoriasBau = ["Todos", "Pessoas", "Móveis", "Animais", "Eletros", "Ferramentas", "Outros"];
let abaBauAtual = "Todos";

const itensBau = [];
let imagensCarregadas = 0;
let scrollBau = 0;
const espacamento = 170;
const xInicial = 120; // Onde os objetos começam a ser desenhados na esteira

// Garante que o multiplayer só conecte DEPOIS que todas as imagens baixarem
configItens.forEach((itemInfo, index) => {
    const img = new Image();
    img.src = `/static/assets/${itemInfo.nome}.png`;
    img.onload = () => {
        itensBau.push({ nome: itemInfo.nome, categoria: itemInfo.cat, img: img, proporcao: img.width / img.height, indexOriginal: index });
        imagensCarregadas++;
        if(imagensCarregadas === configItens.length) {
            itensBau.sort((a, b) => a.indexOriginal - b.indexOriginal);
            // Conecta na sala!
            socket.emit('entrar_na_sala', { sala: SALA_ID });
            desenharTela();
        }
    };
});

const botoesAcao = {
    "Cópia": { x: 15, y: Y_BAU - 45, w: 75, h: 35 },
    "Virar": { x: 100, y: Y_BAU - 45, w: 75, h: 35 },
    "Atrás": { x: 185, y: Y_BAU - 45, w: 75, h: 35 },
    "Frente": { x: 270, y: Y_BAU - 45, w: 75, h: 35 },
    "Travar": { x: 355, y: Y_BAU - 45, w: 75, h: 35 }
};

// =======================================================
// 6. EVENTOS DO MOUSE AND TOUCH (Com Sincronização)
// =======================================================
function collidePoint(rect, px, py) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function descobrirComodoGlobal(x, y) {
    for (const [nome, quad] of Object.entries(quadrantes)) {
        if (collidePoint(quad, x, y)) return nome;
    }
    return "Quarto 1";
}

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = evt.clientX;
    let clientY = evt.clientY;

    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    } else if (evt.changedTouches && evt.changedTouches.length > 0) {
        clientX = evt.changedTouches[0].clientX;
        clientY = evt.changedTouches[0].clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

// --- 1. INICIAR INTERAÇÃO (Clique ou Toque na tela) ---
function iniciarInteracao(e) {
    if(e.type === 'touchstart') e.preventDefault(); 
    const pos = getMousePos(e);

    if (e.type === 'touchstart' || e.button === 0) {
        let clicouNav = false;
        if (abaAtual === "Casa Inteira") {
            for (const [nome, quad] of Object.entries(quadrantes)) {
                const rectLegenda = { x: quad.x + quad.w/2 - 75, y: quad.y + 20, w: 150, h: 40 };
                if (collidePoint(rectLegenda, pos.x, pos.y)) {
                    abaAtual = nome;
                    itemArrastado = itemSelecionado = null;
                    clicouNav = true;
                    break;
                }
            }
        } else {
            const rectHome = { x: 20, y: 20, w: 40, h: 40 };
            if (collidePoint(rectHome, pos.x, pos.y)) {
                abaAtual = "Casa Inteira";
                itemArrastado = itemSelecionado = null;
                clicouNav = true;
            }
        }
        if (clicouNav) return;

        let clicouBotaoAcao = false;
        if (itemSelecionado) {
            for (const [nomeBtn, rectBtn] of Object.entries(botoesAcao)) {
                if (collidePoint(rectBtn, pos.x, pos.y)) {
                    clicouBotaoAcao = true;
                    if (nomeBtn === "Cópia" && !itemSelecionado.travado) {
                        const nova = itemSelecionado.copiar();
                        listaMiniaturasCena.push(nova);
                        itemSelecionado = nova;
                    } else if (nomeBtn === "Virar" && !itemSelecionado.travado) {
                        itemSelecionado.viradoHorizontalmente = !itemSelecionado.viradoHorizontalmente;
                    } else if (nomeBtn === "Frente" && !itemSelecionado.travado) {
                        listaMiniaturasCena = listaMiniaturasCena.filter(i => i !== itemSelecionado);
                        listaMiniaturasCena.push(itemSelecionado);
                    } else if (nomeBtn === "Atrás" && !itemSelecionado.travado) {
                        listaMiniaturasCena = listaMiniaturasCena.filter(i => i !== itemSelecionado);
                        listaMiniaturasCena.unshift(itemSelecionado);
                    } else if (nomeBtn === "Travar") {
                        itemSelecionado.travado = !itemSelecionado.travado;
                    }
                    sincronizarServidor();
                    break;
                }
            }
        }
        if (clicouBotaoAcao) return;

        let clicouRot = false;
        if (itemSelecionado && !itemSelecionado.travado) {
            const rectItem = itemSelecionado.obterRectTela(abaAtual);
            const cx = rectItem.x + rectItem.w / 2;
            const cy = rectItem.y - 20;
            const dist = Math.hypot(pos.x - cx, pos.y - cy);

            if (dist <= 15) {
                itemRotacionando = itemSelecionado;
                clicouRot = true;
                const cCentro = {x: rectItem.x + rectItem.w/2, y: rectItem.y + rectItem.h/2};
                offsetAnguloMouse = Math.atan2(pos.y - cCentro.y, pos.x - cCentro.x) * 180 / Math.PI;
            }
        }
        if (clicouRot) return;

        let clicouPonto = false;
        if (itemSelecionado && !itemSelecionado.travado) {
            const pontos = itemSelecionado.obterRectsPontosControle(abaAtual);
            const rectItem = itemSelecionado.obterRectTela(abaAtual);

            for (const [pType, pRect] of Object.entries(pontos)) {
                // Margem de toque expandida
                const areaToque = { x: pRect.x - 25, y: pRect.y - 25, w: pRect.w + 50, h: pRect.h + 50 };
                if (collidePoint(areaToque, pos.x, pos.y)) {
                    itemRedimensionando = itemSelecionado;
                    pontoControleAtivo = pType;
                    clicouPonto = true;

                    if (pType === "top_left") posAncoraTela = {x: rectItem.x + rectItem.w, y: rectItem.y + rectItem.h};
                    else if (pType === "top_right") posAncoraTela = {x: rectItem.x, y: rectItem.y + rectItem.h};
                    else if (pType === "bottom_left") posAncoraTela = {x: rectItem.x + rectItem.w, y: rectItem.y};
                    else if (pType === "bottom_right") posAncoraTela = {x: rectItem.x, y: rectItem.y};
                    break;
                }
            }
        }
        if (clicouPonto) return;

        let pegou = false;
        for (let i = listaMiniaturasCena.length - 1; i >= 0; i--) {
            const item = listaMiniaturasCena[i];
            const rectItem = item.obterRectTela(abaAtual);
            if (collidePoint(rectItem, pos.x, pos.y)) {
                itemSelecionado = item;
                if (!item.travado) {
                    itemArrastado = item;
                    propX = (pos.x - rectItem.x) / rectItem.w;
                    propY = (pos.y - rectItem.y) / rectItem.h;
                    listaMiniaturasCena.splice(i, 1);
                    listaMiniaturasCena.push(item);
                }
                pegou = true;
                break;
            }
        }

        if (!pegou) {
            // CLIQUE NAS ABAS DO BAÚ
            let clicouAbaBau = false;
            let xAba = 100;
            const yAba = Y_BAU - 5;
            for (const cat of categoriasBau) {
                ctx.font = "bold 16px Arial";
                const wAba = ctx.measureText(cat).width + 30;
                const rectAba = { x: xAba, y: yAba, w: wAba, h: 30 };
                
                if (collidePoint(rectAba, pos.x, pos.y)) {
                    abaBauAtual = cat;
                    scrollBau = 0; // Reseta a barra de rolagem ao trocar de aba
                    clicouAbaBau = true;
                    break;
                }
                xAba += wAba + 5;
            }
            if (clicouAbaBau) return;

            // CLIQUE NOS ITENS DO BAÚ (Apenas os da aba atual)
            let clicouBau = false;
            const itensFiltrados = abaBauAtual === "Todos" ? itensBau : itensBau.filter(i => i.categoria === abaBauAtual);
            
            itensFiltrados.forEach((bauItem, i) => {
                const posX = xInicial + (i * espacamento) + scrollBau;
                
                // Só clica se o item estiver dentro dos limites da caixa transparente
                if (posX > 80 && posX < LARGURA_V - 20) {
                    const rectBau = { x: posX, y: Y_BAU + 40, w: TAMANHO_BAU, h: TAMANHO_BAU };

                    if (collidePoint(rectBau, pos.x, pos.y)) {
                        const comodoInicial = abaAtual === "Casa Inteira" ? "Sala" : abaAtual;
                        const novoItem = new MiniaturaCena(bauItem.nome, bauItem.img, bauItem.proporcao, comodoInicial, 0, 0);
                        listaMiniaturasCena.push(novoItem);
                        itemArrastado = itemSelecionado = novoItem;
                        propX = 0.5; propY = 0.5;
                        clicouBau = true;
                    }
                }
            });
            
            if (!clicouBau && pos.y < Y_BAU) {
                itemSelecionado = null;
            }
        }
    }
}

// --- 2. MOVER INTERAÇÃO (Arrastar, Girar, Escalar) ---
function moverInteracao(e) {
    if(e.type === 'touchmove') e.preventDefault(); 
    const pos = getMousePos(e);

    if (itemRotacionando && !itemRotacionando.travado) {
        const rectAntigo = itemRotacionando.obterRectTela(abaAtual);
        const cAntigo = {x: rectAntigo.x + rectAntigo.w/2, y: rectAntigo.y + rectAntigo.h/2};

        const anguloMouseAtual = Math.atan2(pos.y - cAntigo.y, pos.x - cAntigo.x) * 180 / Math.PI;
        const difAngulo = anguloMouseAtual - offsetAnguloMouse;
        itemRotacionando.angulo = (itemRotacionando.angulo - difAngulo) % 360;
        offsetAnguloMouse = anguloMouseAtual;

        const novoRect = itemRotacionando.obterRectTela(abaAtual);
        const dx = cAntigo.x - (novoRect.x + novoRect.w/2);
        const dy = cAntigo.y - (novoRect.y + novoRect.h/2);

        if (abaAtual === "Casa Inteira") {
            const quad = quadrantes[itemRotacionando.comodo];
            itemRotacionando.xLocal += dx * (LARGURA_V / quad.w);
            itemRotacionando.yLocal += dy * (ALTURA_CENARIO / quad.h);
        } else {
            itemRotacionando.xLocal += dx;
            itemRotacionando.yLocal += dy;
        }
    }
    else if (itemArrastado && !itemArrastado.travado) {
        if (abaAtual === "Casa Inteira") {
            const novoComodo = descobrirComodoGlobal(pos.x, pos.y);
            itemArrastado.comodo = novoComodo;
            const quad = quadrantes[novoComodo];
            const [largura, altura] = itemArrastado.calcularTamanhoRotacionado(abaAtual);

            const topLeftX = pos.x - (largura * propX);
            const topLeftY = pos.y - (altura * propY);
            const cGlobalX = topLeftX + (largura / 2);
            const cGlobalY = topLeftY + (altura / 2);

            const cLocalX = (cGlobalX - quad.x) * (LARGURA_V / quad.w);
            const cLocalY = (cGlobalY - quad.y) * (ALTURA_CENARIO / quad.h);

            const [lComodo, aComodo] = itemArrastado.calcularTamanhoRotacionado(itemArrastado.comodo);
            itemArrastado.xLocal = cLocalX - (lComodo / 2);
            itemArrastado.yLocal = cLocalY - (aComodo / 2);
        } else {
            const [largura, altura] = itemArrastado.calcularTamanhoRotacionado(abaAtual);
            itemArrastado.xLocal = pos.x - (largura * propX);
            itemArrastado.yLocal = pos.y - (altura * propY);
        }
    }
    else if (itemRedimensionando && !itemRedimensionando.travado) {
        const largNova = Math.abs(pos.x - posAncoraTela.x);
        const oldScale = itemRedimensionando.escalaManual;

        itemRedimensionando.escalaManual = 1.0;
        const [largBaseRot] = itemRedimensionando.calcularTamanhoRotacionado(abaAtual);
        itemRedimensionando.escalaManual = oldScale;

        let novaEscala = largNova / Math.max(1, largBaseRot);
        itemRedimensionando.escalaManual = Math.max(0.20, Math.min(3.00, novaEscala));

        const [fLarg, fAlt] = itemRedimensionando.calcularTamanhoRotacionado(abaAtual);

        let tlX = pontoControleAtivo.includes("left") ? posAncoraTela.x - fLarg : posAncoraTela.x;
        let tlY = pontoControleAtivo.includes("top") ? posAncoraTela.y - fAlt : posAncoraTela.y;

        if (abaAtual === "Casa Inteira") {
            const quad = quadrantes[itemRedimensionando.comodo];
            const cGlobalX = tlX + (fLarg / 2);
            const cGlobalY = tlY + (fAlt / 2);
            const cLocalX = (cGlobalX - quad.x) * (LARGURA_V / quad.w);
            const cLocalY = (cGlobalY - quad.y) * (ALTURA_CENARIO / quad.h);

            const [lComodo, aComodo] = itemRedimensionando.calcularTamanhoRotacionado(itemRedimensionando.comodo);
            itemRedimensionando.xLocal = cLocalX - (lComodo / 2);
            itemRedimensionando.yLocal = cLocalY - (aComodo / 2);
        } else {
            itemRedimensionando.xLocal = tlX;
            itemRedimensionando.yLocal = tlY;
        }
    }
}

// --- 3. FINALIZAR INTERAÇÃO (Soltar o dedo/mouse) ---
function finalizarInteracao(e) {
    let teveAcao = (itemArrastado || itemRedimensionando || itemRotacionando);

    // Lógica da Lixeira
    if (itemArrastado) {
        const rect = itemArrastado.obterRectTela(abaAtual);
        if (rect.y + (rect.h / 2) >= Y_BAU) {
            const index = listaMiniaturasCena.indexOf(itemArrastado);
            if (index > -1) {
                listaMiniaturasCena.splice(index, 1);
            }
            if (itemSelecionado === itemArrastado) {
                itemSelecionado = null;
            }
        }
    }

    itemArrastado = null;
    itemRedimensionando = null;
    pontoControleAtivo = null;
    itemRotacionando = null;

    if (teveAcao) {
        sincronizarServidor();
    }
}

// --- CONECTANDO OS EVENTOS AO CANVAS ---
canvas.addEventListener('mousedown', iniciarInteracao);
canvas.addEventListener('mousemove', moverInteracao);
window.addEventListener('mouseup', finalizarInteracao);

canvas.addEventListener('touchstart', iniciarInteracao, {passive: false});
canvas.addEventListener('touchmove', moverInteracao, {passive: false});
window.addEventListener('touchend', finalizarInteracao);


canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pos = getMousePos(e);
    for (let i = listaMiniaturasCena.length - 1; i >= 0; i--) {
        const item = listaMiniaturasCena[i];
        if (collidePoint(item.obterRectTela(abaAtual), pos.x, pos.y)) {
            listaMiniaturasCena.splice(i, 1);
            if (itemSelecionado === item) itemSelecionado = null;
            sincronizarServidor();
            break;
        }
    }
});

// SCROLL DO BAÚ (Respeitando a aba selecionada)
canvas.addEventListener('wheel', (evento) => {
    const pos = getMousePos(evento);
    if (pos.y >= Y_BAU) {
        evento.preventDefault();
        scrollBau += evento.deltaY > 0 ? -60 : 60;
        const itensFiltrados = abaBauAtual === "Todos" ? itensBau : itensBau.filter(i => i.categoria === abaBauAtual);
        const limiteDir = Math.min(0, LARGURA_V - (xInicial + itensFiltrados.length * espacamento + 50));
        scrollBau = Math.max(Math.min(scrollBau, 0), limiteDir);
    }
}, { passive: false });

// =======================================================
// 7. DESENHO
// =======================================================
function desenharRetanguloPontilhado(ctx, cor, rect) {
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
}

function desenharIconeRotacao(ctx, cx, cy, raio) {
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = '#646464'; ctx.lineWidth = 2; ctx.stroke();
    const rArco = raio * 0.6; ctx.beginPath(); ctx.arc(cx, cy, rArco, -Math.PI/2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - rArco, cy); ctx.lineTo(cx - rArco + 5, cy - rArco * 0.3);
    ctx.lineTo(cx - rArco - 5, cy - rArco * 0.3); ctx.fillStyle = '#646464'; ctx.fill(); ctx.restore();
}

function desenharTela() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (abaAtual === "Casa Inteira") {
        for (const [nome, quad] of Object.entries(quadrantes)) {
            if (quad.img.complete && quad.img.naturalWidth !== 0) {
                ctx.drawImage(quad.img, quad.x, quad.y, quad.w, quad.h);
            } else {
                ctx.fillStyle = quad.cor; ctx.fillRect(quad.x, quad.y, quad.w, quad.h);
            }
            ctx.font = "bold 28px Arial";
            const textWidth = ctx.measureText(nome).width;
            ctx.fillStyle = '#ffffff'; ctx.beginPath();
            ctx.roundRect(quad.x + quad.w/2 - textWidth/2 - 10, quad.y + 15, textWidth + 20, 35, 12); ctx.fill();
            ctx.strokeStyle = COR_BORDA; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = COR_TEXTO; ctx.textAlign = "center";
            ctx.fillText(nome, quad.x + (quad.w / 2), quad.y + 42);
        }
        
        // --- DESENHO DAS PAREDES E DIVISÓRIAS (Mantido da sua versão) ---
        let estiloParede = COR_BORDA;
        if (imgFundoBau.complete && imgFundoBau.naturalWidth !== 0) {
            estiloParede = ctx.createPattern(imgFundoBau, 'repeat');
        }

        ctx.fillStyle = estiloParede;
        ctx.fillRect(0, row_h - (ESPESSURA_PAREDE/2), LARGURA_V, ESPESSURA_PAREDE);
        ctx.fillRect(col_w - (ESPESSURA_PAREDE/2), 0, ESPESSURA_PAREDE, Y_BAU);
        ctx.fillRect((col_w * 2) - (ESPESSURA_PAREDE/2), 0, ESPESSURA_PAREDE, Y_BAU);
        
        ctx.lineWidth = ESPESSURA_PAREDE; 
        ctx.strokeStyle = estiloParede; 
        ctx.strokeRect(0, 0, LARGURA_V, Y_BAU);
    } else {
        const quad = quadrantes[abaAtual];
        if (quad.img.complete && quad.img.naturalWidth !== 0) {
            ctx.drawImage(quad.img, 0, 0, LARGURA_V, Y_BAU);
        } else {
            ctx.fillStyle = quad.cor; ctx.fillRect(0, 0, LARGURA_V, Y_BAU);
        }
    }

    listaMiniaturasCena.forEach(item => {
        if (abaAtual === "Casa Inteira") {
            ctx.save();
            const q = quadrantes[item.comodo];
            ctx.beginPath(); ctx.rect(q.x, q.y, q.w, q.h); ctx.clip();
            item.desenhar(ctx, abaAtual);
            ctx.restore();
        } else if (abaAtual === item.comodo) {
            item.desenhar(ctx, abaAtual);
        }
    });

    if (abaAtual !== "Casa Inteira") {
        ctx.fillStyle = COR_BOTAO_ATIVO; ctx.beginPath(); ctx.roundRect(20, 20, 40, 40, 8); ctx.fill();
        ctx.strokeStyle = COR_BORDA; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = COR_TEXTO; ctx.fillRect(30, 36, 20, 14);
        ctx.beginPath(); ctx.moveTo(25, 36); ctx.lineTo(40, 24); ctx.lineTo(55, 36); ctx.fill();
        ctx.font = "bold 28px Arial"; const textW = ctx.measureText(abaAtual).width;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(75, 20, textW + 20, 40, 8); ctx.fill();
        ctx.strokeStyle = COR_BORDA; ctx.stroke();
        ctx.fillStyle = COR_TEXTO; ctx.textAlign = "center"; ctx.fillText(abaAtual, 75 + textW/2 + 10, 48);
    }

    if (itemSelecionado && (abaAtual === "Casa Inteira" || abaAtual === itemSelecionado.comodo)) {
        if (abaAtual === "Casa Inteira") {
            ctx.save(); const q = quadrantes[itemSelecionado.comodo];
            ctx.beginPath(); ctx.rect(q.x, q.y, q.w, q.h); ctx.clip();
        }
        const rectItem = itemSelecionado.obterRectTela(abaAtual);
        const pontos = itemSelecionado.obterRectsPontosControle(abaAtual);
        const corSelecao = itemSelecionado.travado ? '#ff3232' : '#ffffff';
        desenharRetanguloPontilhado(ctx, corSelecao, rectItem);

        if (!itemSelecionado.travado) {
            for (const pRect of Object.values(pontos)) {
                ctx.beginPath(); ctx.arc(pRect.x + pRect.w/2, pRect.y + pRect.h/2, pRect.w/2, 0, Math.PI*2);
                ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#646464'; ctx.lineWidth = 2; ctx.stroke();
            }
            desenharIconeRotacao(ctx, rectItem.x + rectItem.w/2, rectItem.y - 20, 15);
        }
        if (abaAtual === "Casa Inteira") ctx.restore();
    }

    if (itemSelecionado) {
        ctx.font = "20px Arial"; ctx.textAlign = "center";
        for (const [nomeBtn, rBtn] of Object.entries(botoesAcao)) {
            let texto = nomeBtn; let corFundo = '#ffffff';
            if (nomeBtn === "Travar" && itemSelecionado.travado) { texto = "Soltar"; corFundo = '#ffb4b4'; }
            ctx.fillStyle = corFundo; ctx.beginPath(); ctx.roundRect(rBtn.x, rBtn.y, rBtn.w, rBtn.h, 6); ctx.fill();
            ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = '#000000'; ctx.fillText(texto, rBtn.x + rBtn.w/2, rBtn.y + 23);
        }
    }

    // =======================================================
    // --- DESENHO DO BAÚ COM ABAS E SEU FUNDO TRANSPARENTE ---
    // =======================================================
    
    // 1. Fundo total de madeira
    if (imgFundoBau.complete && imgFundoBau.naturalWidth !== 0) {
        ctx.drawImage(imgFundoBau, 0, Y_BAU, LARGURA_V, ALTURA_BAU);
    } else {
        ctx.fillStyle = '#3c2814';
        ctx.fillRect(0, Y_BAU, LARGURA_V, ALTURA_BAU);
    }

    // 2. Borda superior do baú
    ctx.fillStyle = COR_BORDA; 
    ctx.fillRect(0, Y_BAU, LARGURA_V, 6);

    // 3. Fundos semi-transparentes (Mantendo a sua escolha de 0.5 opacidade)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    
    // Caixinha VERTICAL atrás do Título "BAÚ" (Lateral esquerda)
    ctx.beginPath();
    // Mesma altura (180) e posição Y (Y_BAU + 25) da caixa de objetos
    ctx.roundRect(20, Y_BAU + 25, 60, 180, 12); 
    ctx.fill();

    // Texto Vertical "B A Ú"
    // 1. TAMANHO DA LETRA: Mude o "24px" abaixo para aumentar ou diminuir
    ctx.font = "bold 26px Arial"; 
    ctx.fillStyle = COR_TEXTO; 
    ctx.textAlign = "center"; 
    ctx.textBaseline = "middle"; 

    let centroXBau = 50; 
    let topoYBau = Y_BAU + 25;

    // 2. ESPAÇAMENTO VERTICAL: 
    // A caixa tem 180px de altura. O "A" fica no centro exato (90).
    // Aproximamos o B para o 55 e o Ú para o 125. 
    // Isso deixa 55 pixels de folga limpa no topo e na base da caixinha!
    ctx.fillText("B", centroXBau, topoYBau + 55); 
    ctx.fillText("A", centroXBau, topoYBau + 90); 
    ctx.fillText("Ú", centroXBau, topoYBau + 125); 

    // Reseta o alinhamento para não bagunçar os outros textos do jogo
    ctx.textBaseline = "alphabetic";

    // 4. Desenho das Abas Clicáveis
    let xAba = 100;
    const yAba = Y_BAU - 5; // Abas encostadas na caixa maior
    
    categoriasBau.forEach(cat => {
        ctx.font = "bold 16px Arial";
        const wAba = ctx.measureText(cat).width + 30;

        // Visual da aba: Acende (0.8) se estiver selecionada, usa o seu 0.5 se não
        ctx.fillStyle = (abaBauAtual === cat) ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        // Canto arredondado apenas no topo para "colar" na caixa de baixo
        ctx.roundRect(xAba, yAba, wAba, 30, {tl: 8, tr: 8, bl: 0, br: 0}); 
        ctx.fill();

        ctx.fillStyle = COR_TEXTO;
        ctx.textAlign = "center";
        ctx.fillText(cat, xAba + wAba/2, yAba + 21);
        xAba += wAba + 5;
    });

    // 5. Faixa central apenas onde os objetos ficam (Mantendo o seu rgba 0.5)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    // A caixa principal encaixa logo debaixo das abas, por isso cantos quadrados em cima à esquerda
    ctx.roundRect(100, Y_BAU + 25, LARGURA_V - 120, 180, {tl: 0, tr: 12, bl: 12, br: 12}); 
    ctx.fill();

    // 6. Desenho e Recorte dos Objetos do Baú (Apenas da Aba Atual)
    const itensFiltrados = abaBauAtual === "Todos" ? itensBau : itensBau.filter(i => i.categoria === abaBauAtual);
    
    // MÁGICA DO RECORTE: O ctx.clip() impede que objetos "vazem" pra fora da área branca ao rolar
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(100, Y_BAU + 25, LARGURA_V - 120, 180, 12);
    ctx.clip(); 

    itensFiltrados.forEach((item, i) => {
        const posX = xInicial + (i * espacamento) + scrollBau;
        ctx.drawImage(item.img, posX, Y_BAU + 40, TAMANHO_BAU, TAMANHO_BAU);
    });
    
    // Desliga o recorte para o restante da tela
    ctx.restore(); 

    requestAnimationFrame(desenharTela);
}

// =======================================================
// 8. INTERFACE DO TERAPEUTA (Painel Retrátil e Encerrar)
// =======================================================
if (typeof TIPO_USUARIO !== 'undefined' && TIPO_USUARIO === 'anfitriao') {
    const linkPaciente = `${window.location.origin}/sessao/${SALA_ID}?tipo=convidado`;

    // Contêiner para segurar o botão e o painel
    const containerTerap = document.createElement('div');
    containerTerap.style.position = 'absolute';
    containerTerap.style.top = '20px';
    containerTerap.style.left = '20px';
    containerTerap.style.display = 'flex';
    containerTerap.style.flexDirection = 'column';
    containerTerap.style.alignItems = 'flex-start';
    containerTerap.style.gap = '10px';

    // O Botão com a sua Logo
    const btnLogo = document.createElement('img');
    btnLogo.src = '/static/assets/logo.jpg'; // Usando a imagem salva
    btnLogo.style.width = '70px';
    btnLogo.style.height = '70px';
    btnLogo.style.borderRadius = '50%';
    btnLogo.style.cursor = 'pointer';
    btnLogo.style.border = '3px solid #a06e32';
    btnLogo.style.boxShadow = '0 4px 10px rgba(0,0,0,0.6)';
    btnLogo.style.transition = 'transform 0.2s';
    btnLogo.title = "Controles da Sessão";

    // Efeito visual ao passar o mouse na logo
    btnLogo.onmouseenter = () => btnLogo.style.transform = 'scale(1.1)';
    btnLogo.onmouseleave = () => btnLogo.style.transform = 'scale(1.0)';

    // O Painel oculto
    const painel = document.createElement('div');
    painel.style.display = 'none'; // Começa escondido
    painel.style.background = 'rgba(0,0,0,0.85)';
    painel.style.padding = '15px 20px';
    painel.style.borderRadius = '10px';
    painel.style.color = 'white';
    painel.style.fontFamily = 'Arial';
    painel.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
    painel.style.border = '2px solid #a06e32';

    painel.innerHTML = `
        <div style="font-size: 14px; margin-bottom: 8px;">Link de acesso do Paciente:</div>
        <div style="display: flex; gap: 8px;">
            <input type="text" id="linkPac" value="${linkPaciente}" readonly
                   style="padding: 8px; width: 250px; border-radius: 6px; border: none; outline: none; background: #eee; color: #333;">
            <button onclick="
                const input = document.getElementById('linkPac');
                input.select();
                document.execCommand('copy');
                this.innerText='Copiado!';
                this.style.background='#27ae60';"
                style="padding: 8px 16px; cursor: pointer; background: #a06e32; color: white; border: none; border-radius: 6px; font-weight: bold; transition: 0.2s;">
                Copiar
            </button>
        </div>

        <hr style="border: 0; height: 1px; background: #a06e32; margin: 15px 0;">

        <button id="btnEncerrar" style="width: 100%; padding: 10px; cursor: pointer; background: #c0392b; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; transition: 0.2s;">
            🛑 Encerrar Sessão
        </button>
    `;

    // Lógica para abrir/fechar o painel ao clicar na logo
    btnLogo.onclick = () => {
        if (painel.style.display === 'none') {
            painel.style.display = 'block';
        } else {
            painel.style.display = 'none';
        }
    };

    containerTerap.appendChild(btnLogo);
    containerTerap.appendChild(painel);
    document.body.appendChild(containerTerap);

    // Lógica do botão de Encerrar
    document.getElementById('btnEncerrar').onclick = () => {
        if(confirm("Tem certeza que deseja ENCERRAR esta sessão? O paciente perderá o acesso imediatamente.")) {
            // Avisa o servidor para fechar a sala
            socket.emit('encerrar_sessao', { sala: SALA_ID });
        }
    };
}

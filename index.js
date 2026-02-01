require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs'); 

console.log("Iniciando o sistema EndRunner V2...");

// --- CONFIGURAÇÃO DE ADMINS ---
// Aqui estão: Você (pelo .env) e o ID extra que pediu
const ADMINS = [
    process.env.SEU_ID_ADMIN, 
    '576901152336117771' 
];

// Função para verificar se é admin
const isAdmin = (id) => ADMINS.includes(id);

// 1. CRIAR O CLIENTE
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
    ]
});

// 2. SISTEMA DE DADOS
let db = { duplas: {} };

// Tenta carregar o banco de dados se ele existir
if (fs.existsSync('./dados.json')) {
    try {
        const dadosBrutos = fs.readFileSync('./dados.json', 'utf8');
        if (dadosBrutos.trim().length > 0) {
            db = JSON.parse(dadosBrutos);
        }
    } catch (erro) {
        console.log("⚠️ Banco de dados vazio ou corrompido. Criando novo...");
    }
}

const salvar = () => {
    fs.writeFileSync('./dados.json', JSON.stringify(db, null, 2));
}

const pegarData = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// 3. EVENTOS
client.once('ready', () => {
    console.log(`✅ BOT ONLINE: ${client.user.tag}`);
    console.log(`🛡️ Admins carregados: ${ADMINS.length}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; 

    // Ignora mensagens que não começam com ! para economizar processamento
    if (!message.content.startsWith('!')) return;

    const args = message.content.trim().split(/ +/);
    const comando = args[0].toLowerCase();

    // --- COMANDOS ---

    // !registrar (Público)
    if (comando === '!registrar') {
        const nomeTime = args.slice(1).join('_'); // Troca espaço por underline
        if (!nomeTime) return message.reply("⚠️ Use: `!registrar Nome_Do_Time`");
        
        if (db.duplas[nomeTime]) return message.reply("❌ Esse time já existe!");

        db.duplas[nomeTime] = { 
            fase: 1, pontos: 0, bosses: 0, marcos: 0, historico: [] 
        };
        
        db.duplas[nomeTime].historico.push({
            data: pegarData(), motivo: "Time Registrado", valor: 0
        });
        
        salvar();
        return message.reply(`✅ Time **${nomeTime}** registrado na FASE 1! Boa sorte!`);
    }

    // !check (Apenas Admins)
    if (comando === '!check') {
        try { await message.delete(); } catch (e) {} // Limpa msg do admin

        if (!isAdmin(message.author.id)) return message.channel.send(`🔒 Você não é admin.`);

        const nomeTime = args[1];
        const tipo = args[2]?.toLowerCase(); 

        if (!db.duplas[nomeTime]) return message.channel.send(`❌ Time **${nomeTime}** não encontrado.`);
        if (!db.duplas[nomeTime].historico) db.duplas[nomeTime].historico = [];

        let pontos = 0;
        let motivo = "";
        let mensagem = "";

        switch (tipo) {
            case 'marco':
                pontos = 100;
                motivo = "Completou Marco";
                db.duplas[nomeTime].marcos += 1;
                if (db.duplas[nomeTime].marcos % 4 === 0) {
                    db.duplas[nomeTime].fase += 1;
                    mensagem = `🚀 **${nomeTime}** SUBIU PARA A FASE ${db.duplas[nomeTime].fase}! (+100 pts)`;
                } else {
                    mensagem = `📸 Marco validado para **${nomeTime}**! (+100 pts)`;
                }
                break;

            case 'boss':
                pontos = 500;
                motivo = "Derrotou Boss";
                db.duplas[nomeTime].bosses += 1;
                mensagem = `⚔️ **${nomeTime}** matou um Boss! (+500 pts)`;
                break;

            case 'construcao1':
                pontos = 250;
                motivo = "Melhor Construção (1º)";
                mensagem = `🏰 **${nomeTime}** ganhou a MELHOR CONSTRUÇÃO! (+250 pts)`;
                break;
            
            case 'construcao2':
                pontos = 150;
                motivo = "2ª Melhor Construção";
                mensagem = `🔨 **${nomeTime}** ficou em 2º na Construção! (+150 pts)`;
                break;

            case 'construcao3':
                pontos = 50;
                motivo = "3ª Melhor Construção";
                mensagem = `🏠 **${nomeTime}** ficou em 3º na Construção! (+50 pts)`;
                break;

            case 'punicao':
                pontos = -500;
                motivo = "Punição Grave";
                mensagem = `🚨 **${nomeTime}** foi PUNIDO! (-500 pts)`;
                break;

            case 'dragao':
                pontos = 2000;
                motivo = "Zerou (The End)";
                mensagem = `🐉 **${nomeTime}** MATOU O DRAGÃO E ZEROU O DESAFIO! (+2000 pts)`;
                break;

            default:
                return message.channel.send(`⚠️ **Tipo inválido!** Use: marco, boss, dragao, punicao, construcao1, construcao2, construcao3.`);
        }

        db.duplas[nomeTime].pontos += pontos;
        db.duplas[nomeTime].historico.push({
            data: pegarData(), motivo: motivo, valor: pontos > 0 ? `+${pontos}` : `${pontos}`
        });
        salvar();
        message.channel.send(mensagem);
    }

    // !pontos (Bônus Manual 0-1000)
    if (comando === '!pontos') {
        try { await message.delete(); } catch (e) {}

        if (!isAdmin(message.author.id)) return;

        const nomeTime = args[1];
        const valor = parseInt(args[2]);
        const motivoTexto = args.slice(3).join(' ');

        if (!db.duplas[nomeTime]) return message.channel.send("❌ Time não encontrado.");
        if (isNaN(valor)) return message.channel.send("⚠️ Digite um número válido.");
        if (!motivoTexto) return message.channel.send("⚠️ Diga o motivo!");
        if (Math.abs(valor) > 1000) return message.channel.send(`⚠️ Limite de 1000 pontos por vez.`);

        if (!db.duplas[nomeTime].historico) db.duplas[nomeTime].historico = [];

        db.duplas[nomeTime].pontos += valor;
        db.duplas[nomeTime].historico.push({
            data: pegarData(), motivo: `Missão Bônus: ${motivoTexto}`, valor: valor > 0 ? `+${valor}` : `${valor}`
        });
        salvar();

        const emoji = valor > 0 ? "✨" : "📉";
        message.channel.send(`${emoji} **${nomeTime}** recebeu BÔNUS: ${valor} pts.\n*Motivo: ${motivoTexto}*`);
    }

    // !ranking (Público)
    if (comando === '!ranking') {
        try { await message.delete(); } catch (e) {}

        const embed = new EmbedBuilder()
            .setTitle('🏆 PLACAR GERAL - THE END RUNNER')
            .setColor('Gold')
            .setFooter({ text: 'Atualizado em tempo real' });

        const listaOrdenada = Object.entries(db.duplas).sort((a, b) => b[1].pontos - a[1].pontos);

        if (listaOrdenada.length === 0) embed.setDescription("Nenhum time registrado ainda.");

        listaOrdenada.forEach(([nome, dados], index) => {
            let medalha = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "👾";
            embed.addFields({
                name: `${medalha} ${index + 1}º ${nome}`,
                value: `**${dados.pontos} pts** | Fase ${dados.fase} | Bosses: ${dados.bosses}`
            });
        });
        message.channel.send({ embeds: [embed] });
    }

    // !historico (Público)
    if (comando === '!historico') {
        try { await message.delete(); } catch (e) {}

        const nomeTimeFull = args[1]; 
        if (!nomeTimeFull) return message.channel.send("⚠️ Use: `!historico Nome_Do_Time`");
        
        if (!db.duplas[nomeTimeFull]) return message.channel.send("❌ Time não encontrado.");

        const dados = db.duplas[nomeTimeFull];
        const historico = dados.historico || [];
        
        const embed = new EmbedBuilder()
            .setTitle(`📜 Extrato: ${nomeTimeFull}`)
            .setColor('Blue')
            .setDescription(`**Pontuação Atual: ${dados.pontos}**`);

        const ultimos10 = historico.slice(-10).reverse(); 
        if (ultimos10.length === 0) {
            embed.addFields({ name: "Vazio", value: "Nenhum evento registrado." });
        } else {
            ultimos10.forEach(item => {
                embed.addFields({
                    name: `${item.data} | ${item.valor} pts`,
                    value: `📝 ${item.motivo}`,
                    inline: false
                });
            });
        }
        message.channel.send({ embeds: [embed] });
    }

    // !limpar Quantidade (Novo comando adicionado)
    if (comando === '!limpar') {
        if (!isAdmin(message.author.id)) return; // Só admin usa

        const quantidade = parseInt(args[1]) || 99; // Se não disser numero, apaga 99

        if (quantidade < 1 || quantidade > 100) {
            return message.channel.send("⚠️ Escolha um número entre 1 e 99.");
        }

        try {
            await message.channel.bulkDelete(quantidade, true);
            const aviso = await message.channel.send(`🧹 **Faxina feita!** Apaguei ${quantidade} mensagens.`);
            setTimeout(() => aviso.delete(), 5000); // Some depois de 5 segundos
        } catch (erro) {
            message.channel.send("❌ Erro: Mensagens muito antigas não podem ser apagadas.");
        }
    }

    // !resetar (Admin - Perigoso)
    if (comando === '!resetar') {
        if (!isAdmin(message.author.id)) return;
        
        db = { duplas: {} };
        salvar();
        message.channel.send("☢️ **O SISTEMA FOI RESETADO! Todos os pontos voltaram a zero.**");
    }
});

client.login(process.env.SEU_TOKEN);
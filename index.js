require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs'); 

console.log("Iniciando o sistema EndRunner...");

// 1. CRIAR O CLIENTE (O ROBÔ)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
    ]
});

// 2. SISTEMA DE DADOS
let db = { duplas: {} };

// Carrega os dados com segurança
if (fs.existsSync('./dados.json')) {
    try {
        const dadosBrutos = fs.readFileSync('./dados.json', 'utf8');
        if (dadosBrutos.trim().length > 0) {
            db = JSON.parse(dadosBrutos);
        }
    } catch (erro) {
        console.log("⚠️ Criando novo banco de dados...");
    }
}

const salvar = () => {
    fs.writeFileSync('./dados.json', JSON.stringify(db, null, 2));
}

const pegarData = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// 3. EVENTOS (O QUE O ROBÔ FAZ)
client.once('ready', () => {
    console.log(`✅ BOT ONLINE: ${client.user.tag}`);
    console.log(`👀 Monitorando: !registrar, !check, !pontos, !historico`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; 

    const args = message.content.trim().split(/ +/);
    const comando = args[0].toLowerCase();

    // --- COMANDOS ---

    // !registrar
    if (comando === '!registrar') {
        const nomeTime = args.slice(1).join(' ');
        if (!nomeTime) return message.reply("⚠️ Use: `!registrar Nome Do Time`");
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

    // !check (Admin)
    if (comando === '!check') {
        if (message.author.id !== process.env.SEU_ID_ADMIN) return message.reply("🔒 Apenas Admin!");

        const nomeTime = args[1];
        const tipo = args[2]; 

        if (!db.duplas[nomeTime]) return message.reply("❌ Time não encontrado.");
        if (!db.duplas[nomeTime].historico) db.duplas[nomeTime].historico = [];

        let pontosGanhos = 0;
        let motivo = "";

        if (tipo === 'boss') {
            pontosGanhos = 500;
            motivo = "Derrotou Boss";
            db.duplas[nomeTime].bosses += 1;
            message.reply(`⚔️ **${nomeTime}** matou um Boss! (+500 pts)`);
        } else if (tipo === 'marco') {
            pontosGanhos = 100;
            motivo = "Completou Marco";
            db.duplas[nomeTime].marcos += 1;
            
            if (db.duplas[nomeTime].marcos % 4 === 0) {
                db.duplas[nomeTime].fase += 1;
                message.reply(`🚀 **${nomeTime}** SUBIU PARA A FASE ${db.duplas[nomeTime].fase}!`);
            } else {
                message.reply(`📸 Marco validado para **${nomeTime}**! (+100 pts)`);
            }
        } else {
            return message.reply("⚠️ Use: `!check NomeTime boss` ou `!check NomeTime marco`");
        }

        db.duplas[nomeTime].pontos += pontosGanhos;
        db.duplas[nomeTime].historico.push({
            data: pegarData(), motivo: motivo, valor: `+${pontosGanhos}`
        });
        salvar();
    }

    // !pontos (Admin)
    if (comando === '!pontos') {
        if (message.author.id !== process.env.SEU_ID_ADMIN) return message.reply("🔒 Apenas Admin!");

        const nomeTime = args[1];
        const valor = parseInt(args[2]);
        const motivoTexto = args.slice(3).join(' ');

        if (!db.duplas[nomeTime]) return message.reply("❌ Time não encontrado.");
        if (isNaN(valor)) return message.reply("⚠️ Valor inválido.");
        if (!motivoTexto) return message.reply("⚠️ Diga o motivo!");

        if (!db.duplas[nomeTime].historico) db.duplas[nomeTime].historico = [];

        db.duplas[nomeTime].pontos += valor;
        db.duplas[nomeTime].historico.push({
            data: pegarData(), motivo: motivoTexto, valor: valor > 0 ? `+${valor}` : `${valor}`
        });
        salvar();

        const emoji = valor > 0 ? "✨" : "🚨";
        message.reply(`${emoji} **${nomeTime}**: ${valor} pontos. Motivo: *${motivoTexto}*`);
    }

    // !ranking
    if (comando === '!ranking') {
        const embed = new EmbedBuilder()
            .setTitle('🏆 PLACAR GERAL')
            .setColor('Gold');

        const listaOrdenada = Object.entries(db.duplas).sort((a, b) => b[1].pontos - a[1].pontos);

        if (listaOrdenada.length === 0) embed.setDescription("Nenhum time registrado.");

        listaOrdenada.forEach(([nome, dados], index) => {
            let medalha = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "👾";
            embed.addFields({
                name: `${medalha} ${index + 1}º ${nome}`,
                value: `**${dados.pontos} pts** | Fase ${dados.fase} | Bosses: ${dados.bosses}`
            });
        });
        message.reply({ embeds: [embed] });
    }

    // !historico
    if (comando === '!historico') {
        const nomeTimeFull = args.slice(1).join(' ');
        if (!nomeTimeFull) return message.reply("⚠️ Use: `!historico NomeDoTime`");
        if (!db.duplas[nomeTimeFull]) return message.reply("❌ Time não encontrado.");

        const dados = db.duplas[nomeTimeFull];
        const historico = dados.historico || [];
        const embed = new EmbedBuilder()
            .setTitle(`📜 Extrato: ${nomeTimeFull}`)
            .setColor('Blue')
            .setDescription(`**Total: ${dados.pontos}**`);

        const ultimos10 = historico.slice(-10).reverse(); 
        if (ultimos10.length === 0) {
            embed.addFields({ name: "Vazio", value: "..." });
        } else {
            ultimos10.forEach(item => {
                embed.addFields({
                    name: `${item.data} | ${item.valor} pts`,
                    value: `📝 ${item.motivo}`,
                    inline: false
                });
            });
        }
        message.reply({ embeds: [embed] });
    }

    // !resetar (Admin)
    if (comando === '!resetar') {
        if (message.author.id !== process.env.SEU_ID_ADMIN) return message.reply("🔒 Sem permissão.");
        db = { duplas: {} };
        salvar();
        message.reply("☢️ **RESET REALIZADO!**");
    }
});

// 4. LOGIN (SEMPRE A ÚLTIMA LINHA)
// O Debug mostrou que o token existe, então podemos logar direto
client.login(process.env.SEU_TOKEN);
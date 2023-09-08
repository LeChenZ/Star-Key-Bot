const { Client, Intents, MessageEmbed } = require('discord.js');
const express = require('express');
const config = require('./config.json');
const fs = require('fs');
const requestIp = require('request-ip');
const axios = require('axios');

const app = express();
const port = config.portweb || 80;

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

const dbPath = './db.json';
let db = require(dbPath);

function saveDB() {
  fs.writeFileSync(dbPath, JSON.stringify(db));
}

let attempts = {};
const maxAttempts = 3;
const cooldownTime = 5000;

function isInThePast(date) {
  const today = new Date();
  return date < today;
}

function getNumberOfDays(end) {
  const date1 = new Date(Date.now());
  const date2 = new Date(end);
  const oneDay = 1000 * 60 * 60 * 24;
  const diffInTime = date2.getTime() - date1.getTime();
  const diffInDays = Math.round(diffInTime / oneDay);
  return diffInDays;
}

client.once('ready', () => {
client.user.setActivity("StarKeyBot", {
  type: "STREAMING",
  url: "https://www.twitch.tv/lechenzmp4"
});
  console.log('BOT STATUS: ON');
});

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.bot.prefix)) return;

    const args = message.content.slice(config.bot.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'help') {
      const embed = new MessageEmbed()
        .setColor('#00ff00')
        .setTitle('Aide')
        .setDescription('Voici la liste des commandes disponibles :')
        .addField(`${config.bot.prefix}check <clé>`, 'Vérifie la validité d\'une clé.')
        .addField(`${config.bot.prefix}addkey <clé> <ID Discord> <date d'expiration (2025-01-25)> <IP du serveur>`, 'Ajoute une nouvelle clé.')
        .addField(`${config.bot.prefix}delkey <clé>`, 'Supprime une clé.')
        .addField(`${config.bot.prefix}keyinfo <clé>`, 'Affiche les informations d\'une clé.')
        .addField(`${config.bot.prefix}ipreset <clé> <nouvelle adresse IP>`, 'Réinitialise l\'adresse IP d\'une clé.');

      message.channel.send({ embeds: [embed] });
    }

    if (command === 'check') {
      const key = args[0];
      const discordId = message.author.id;

      if (!key) {
        message.reply('Veuillez fournir une clé à vérifier.');
        return;
      }

      if (!db.keys[key]) {
        message.reply('La clé fournie est invalide.');
        return;
      }

      const keyData = db.keys[key][0];

      if (keyData.DiscordID !== discordId) {
        message.reply('La clé fournie ne vous appartient pas.');
        return;
      }

      if (isInThePast(keyData.time)) {
        message.reply('Votre clé est expirée.');
        return;
      }

      const daysRemaining = getNumberOfDays(keyData.time);

      message.reply(`Votre clé est valide. Il vous reste ${daysRemaining} jours.`);

      return;
    }

    if (command === 'addkey') {
      if (!config.bot.owner.includes(message.author.id)) {
        message.reply("Vous n'êtes pas autorisé à utiliser cette commande.");
        return;
      }

      const key = args[0];
      const discordId = args[1];
      const time = args[2];
      const srvip = args[3];

      if (!key || !discordId || !time || !srvip) {
        message.reply('Veuillez fournir tous les arguments nécessaires.');
        return;
      }

      if (db.keys[key]) {
        message.reply('La clé fournie existe déjà.');
        return;
      }

      const newKeyData = {
        DiscordID: discordId,
        time: time,
        srvip: srvip
      };

      db.keys[key] = [newKeyData];
      saveDB();

      message.reply('La clé a été ajoutée avec succès.');

      return;
    }

    if (command === 'delkey') {
      if (!config.bot.owner.includes(message.author.id)) {
        message.reply("Vous n'êtes pas autorisé à utiliser cette commande.");
        return;
      }

      const key = args[0];

      if (!key) {
        message.reply('Veuillez fournir une clé à supprimer.');
        return;
      }

      if (!db.keys[key]) {
        message.reply('La clé fournie n\'existe pas.');
        return;
      }

      delete db.keys[key];
      saveDB();

      message.reply('La clé a été supprimée avec succès.');

      return;
    }

    if (command === 'keyinfo') {
      const key = args[0];

      if (!key) {
        message.reply('Veuillez fournir une clé à vérifier.');
        return;
      }

      if (!db.keys[key]) {
        message.reply('La clé fournie est invalide.');
        return;
      }

      const keyData = db.keys[key][0];

      const embed = new MessageEmbed()
        .setColor('#7d3efa')
        .setTitle('Informations sur la clé')
        .addField('Clé', key)
        .addField('Utilisateur', `<@${keyData.DiscordID}>`)
        .addField('Date d\'expiration', keyData.time)
        .addField('IP du serveur', keyData.srvip);

      message.reply({ embeds: [embed] });

      return;
    }

if (command === 'ipreset') {
  if (!config.bot.owner.includes(message.author.id)) {
    message.reply("Vous n'êtes pas autorisé à utiliser cette commande.");
    return;
  }

  const key = args[0];
  const newIP = args[1];

  if (!key || !newIP) {
    message.reply('Veuillez fournir une clé et une nouvelle adresse IP.');
    return;
  }

  if (!db.keys[key]) {
    message.reply('La clé fournie est invalide.');
    return;
  }

  db.keys[key][0].srvip = newIP;
  saveDB();

  message.reply('L\'adresse IP de la clé a été mise à jour avec succès.');

  return;
}
  });

  client.login(config.bot.token);


app.get('/', async (req, res) => {
  const key = req.query.key;

  if (!key) {
    res.status(400).send('Requête invalide.');
    return;
  }

  const matchingKeys = Object.keys(db.keys).filter((keyName) => keyName === key);

  if (matchingKeys.length === 0) {
    res.status(404).send('Clé invalide.');
    return;
  }

  const keyData = db.keys[matchingKeys[0]][0];
  const clientIP = req.headers['x-real-ip'] || req.connection.remoteAddress;

  if (isInThePast(keyData.time)) {
    res.status(403).send('Clé expirée.');
    return;
  }

  try {
    const response = await axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=${config.ipgeo_key}&ip=${clientIP}`); // https://app.ipgeolocation.io/
    const { ip, country } = response.data;

    const matchingIPs = keyData.srvip === ip;

    if (!matchingIPs) {
      res.status(403).send('Adresse IP non autorisée.');
      return;
    }

    const daysRemaining = getNumberOfDays(keyData.time);
    res.send(`Clé valide. Il vous reste ${daysRemaining} jours. `);

  } catch (error) {
    console.error(error);
    res.status(500).send('Erreur lors de la vérification de l\'adresse IP.');
  }
});

app.listen(port, () => {
  console.log(`Serveur web en écoute sur le port ${port}`);
});

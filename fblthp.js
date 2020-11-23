const config = require('./config.js').config;
const unmodifiedQuotes = require("./quotes.json");
const quotes = require("./quotes.json");
const fs = require("fs");
const irc = require("irc");
const commandRegex = /\.(?<command>add|quote|help|man)(?: (?<name>[\w-]+)(?: (?<quote>.*?(?=$|\s--\w+)) ?(?<labels>(?: ?(--\w+)?)+))?)?/;
const ignoredUsers = [ "Fryatog", //rules bot, don't bother logging this
                       "BlizzardWasRight", //likely to abuse
                       "github_die_tk",
                       "die_tk",
                       "BigInJapan"]

var bot = new irc.Client(config.server, config.botName, { channels: config.channels, realName: config.realName });

// Ident listener; fires once on connect
bot.addListener("registered", function(message) {
  bot.say("nickserv", `identify ${config.ident}`);
});

// Logging listener
bot.addListener("message", function(from, to, message) {
  if (ignoredUsers.includes(from)) return;

  var stream = fs.createWriteStream(to.replace(/#/gi, "") + ".log", {flags:"a"});

  var date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" });
  var time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute:"2-digit" });

  stream.write(date + " " + time + " <" + from + "> " + message + "\n", "utf8");
});

// Quote nonsense listener
bot.addListener("message", function(from, to, message) {
  messageListener(from, to, message);
});

function messageListener(from, to, message) {
  message = message.toLowerCase();
  let splitMsg = message.match(commandRegex);

  if (!splitMsg) {
    return;
  }

  let command = splitMsg.groups.command;
  let name = splitMsg.groups.name;
  let quote = splitMsg.groups.quote;
  let labels = splitMsg.groups.labels;

  switch(command) {
    case "add":
      addQuote(from, to, name, quote, labels);
      break;
    case "quote":
      // hacky bullshit - the regex captures a specific label
      // in the `quote` group, so... let's roll with it I guess
      getQuote(from, to, name, quote);
      break;
    case "man":
    case "help":
      getHelp(from);
      break;
  }
}

// Handles IRC errors here instead of just crashing the app
bot.addListener("error", function(message) {
  console.log("IRC error: ", message);
});

function getHelp(from) {
  bot.say(from, "\x02.add $NAME $QUOTE [--$LABELS]:\x0F");
  bot.say(from, "Add a $QUOTE for $NAME for each given $LABEL. Ex: .quote Tyler What's a nubian? --nubian");
  bot.say(from, "\x02.quote $NAME? $LABEL?:\x0F");
  bot.say(from, "Gets the specific quote with $LABEL from $NAME. If $LABEL is omitted, gets random quote from $NAME. If $NAME also omitted, gets random quote from entire db.");
}

function updateQuotesFile() {
  fs.writeFile("./quotes.json", JSON.stringify(quotes, null, 4), (err) => {
    if (err) {
      console.error(err);
      return;
    }
    if (quotes != unmodifiedQuotes) {
      console.log("Updated quotes at", new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute:"2-digit" }));
    }
  });
}

setInterval(updateQuotesFile, 5000);

function getQuote(from, to, name, label) {
  let keys = Object.keys(quotes);
  let randomIndex = Math.floor(Math.random() * keys.length);
  let randomKey = keys[randomIndex];

  name = name || randomKey;
  let user = quotes[name];
  
  if (!user) {
    bot.say(from, `No quotes found for ${name}.`);
    return;
  }

  keys = Object.keys(user);
  randomIndex = Math.floor(Math.random() * keys.length);
  randomKey = keys[randomIndex];
  
  label = label || randomKey;
  let quote = user[label];
  
  if (quote) {
    if (to == config.botName) {
      bot.say(from, `"${quote.text}" -- ${name}, ${quote.date}`);
    } else {
      bot.say(to, `"${quote.text}" -- ${name}, ${quote.date}`); 
    }
  } else {
    bot.say(from, `No quotes found with label ${label} for ${name}.`);
  }
}

function addQuote(from, to, name, quote, labels) {
  if (!labels) {
    bot.say(from, "You have to specify a label for the quote with --label. See \x02.man\x0F for full instructions.");
    return
  }

  if (!quotes[name]) {
    quotes[name] = {};
  }

  let splitLabels = labels.replace(/--/g, "").split(" ");
  splitLabels.forEach(label => quotes[name][label] = new Quote(quote));
  if (to == config.botName) {
    bot.say(from, "Added quote for " + name);
  } else {
    bot.say(to, "Added quote for " + name);
  }
}

function Quote(text) {
  this.date = new Date().toLocaleDateString();
  this.text = text;
}

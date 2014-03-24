var linereader = require('line-reader'),
	Waterline = require('waterline'),
	clc = require('cli-color'),
	config = require('./config.js').config,
	orm = new Waterline();

var silent = false;
if(process.argv.length > 2){ //First two arguments will ALWAYS be node and app
	for(var i = 2, ii = process.argv.length; i < ii; i++){
		var argument = process.argv[i];
		if(argument === "-s" || argument === "--silent"){
			silent = true;
		}else if(argument === "-?" || argument === "--help"){
			console.log("The following are valid command line arguments:");
			console.log("  -s or --silent\t- Turns on silent mode, no console logs will occur.");
			console.log("  -? or --help\t\t- Displays this message");
			process.exit(0);
		}else{
			console.log("Unknown argument " + argument + ", use -? or --help to see a list of valid arguments.");
			process.exit(0);
		}
	}
}

String.prototype.getProperty = function(prop){
	var regex = new RegExp(prop+'="([^"]*)"');
	var data = this.valueOf().match(regex);
	if(!data) return null;
	return data[1];
};

var character = function(){
	return {
		name: "",
		sex: "",
		vocation: "",
		level: "",
		world: "",
		residence: "",
		lastlogin: "",
		accountstate: "",
		charcreated: "",
		comment: "",
		signature: "",
		creationDate: "",
		deaths: [],
		achievements: [],
		formerNames: []
	};
};

var achievement = function(line){
	var name = line.getProperty("name");
	var grade = line.getProperty("grade");
	var secret = line.getProperty("secret");

	return {
		name: name,
		grade: grade,
		secret: secret != null
	};
};

var deathObject = function(line){
	var date = line.getProperty("date");
	var level = line.getProperty("level");
	var murderercount = line.getProperty("murderercount");
	
	return {
		date: date,
		level: level,
		murderercount: murderercount,
		murderers: []
	};
};

var murdererObject = function(line){
	var monster = line.getProperty("monster");
	var character = line.getProperty("character");
	var participation = line.getProperty("participation");
	
	return {
		monster: monster,
		character: character,
		participation: participation,
		pvp: character != null,
		unknown: monster == null && character == null
	};
};

var formerNameObject = function(line){
	var name = line.getProperty("name");
	return {
		name: name
	};
}

var FormerName = Waterline.Collection.extend({
    identity: 'formername',
    connection: 'mySqlAdapter',
    tableName: 'formernames',
    attributes: {
		name: "string",
		player: "string",
		id: {type: 'integer', autoIncrement: true, primaryKey: true}
    }
});

var Achievement = Waterline.Collection.extend({
    identity: 'achievement',
    connection: 'mySqlAdapter',
    tableName: 'achievements',
    attributes: {
		name: "string",
		grade: "string",
		secret: "boolean",
		player: "string",
		id: {type: 'integer', autoIncrement: true, primaryKey: true}
    }
});

var Murderer = Waterline.Collection.extend({
    identity: 'murderer',
    connection: 'mySqlAdapter',
    tableName: 'murderers',
    attributes: {
		monster: "string",
		character: "string",
		participation: "string",
		pvp: "boolean",
		unknown: "boolean",
		id: {type: 'integer', autoIncrement: true, primaryKey: true},
		murderId: {type: "string"}
    }
});

var Death = Waterline.Collection.extend({
    identity: 'death',
    connection: 'mySqlAdapter',
    tableName: 'deaths',
    attributes: {
		date: "date",
		level: "integer",
		murderercount: "integer",
		id: {type: 'integer', autoIncrement: true, primaryKey: true},
		player: "string",
		murderId: {type: "string"}
    }
});

var Player = Waterline.Collection.extend({
    identity: 'player',
    connection: 'mySqlAdapter',
    tableName: 'players',
    attributes: {
        name: "string",
		sex: "string",
		vocation: "string",
		level: "integer",
		world: "string",
		residence: "string",
		lastlogin: "date",
		accountstate: "string",
		charcreated: "date",
		comment: "string",
		signature: "string",
		creationDate: "date",
		id: {type: 'integer', autoIncrement: true, primaryKey: true}
    }
});

orm.loadCollection(FormerName);
orm.loadCollection(Achievement);
orm.loadCollection(Player);
orm.loadCollection(Death);
orm.loadCollection(Murderer);


//Variables for data logging
var lines = 0;
var characters = 0;

//Current character, will store information about the character currently being processed
var currentCharacter = null;

//Character properties, these get looped over and regex'd with, then the character object gets set with them in array notation
var characterProperties = ["name", "sex", "vocation", "level", "world", "residence", "lastlogin", "accountstate", "charcreated"];

//Bools to see if we're in things
var inCharacter = false;

//Comment
var inComment = false;
var commentArray = [];

//Signature
var inSignature = false;
var signatureArray = [];

//Deaths
var inDeath = false;
var currentDeath = null;

//Insert SQL data
var insertCharacterSql = [];
var insertCharacterValues = [];

var insertDeathSql = [];
var insertDeathValues = [];

var insertMurdererSql = [];
var insertMurdererValues = [];

var insertAchievementSql = [];
var insertAchievementValues = [];

var insertFormerNameSql = [];
var insertFormerNameValues = [];

var charactersDone = 0;
var done = false;

var app = {};
// Start Waterline passing adapters in
orm.initialize(config, function (err, models) {
    if (err) throw err;

    app.models = models.collections;
    app.connections = models.connections;

    runProgram();
});

var createFormerNames = function(currentPlayer){
	for(var i = 0, k = currentPlayer.formerNames.length; i < k; i++){
		var previousName = currentPlayer.formerNames[i];
		previousName.player = currentPlayer.name;
		var insertString = "";
		if(insertFormerNameSql.length === 0){
			insertString = "INSERT INTO `tibiaapi`.`formernames` (`name`, `player`, `id`, `createdAt`, `updatedAt`) VALUES (?, ?, NULL, NOW(), NOW())";
		}else{
			insertString = ",  (?, ?, NULL, NOW(), NOW())";
		}
		insertFormerNameSql.push(insertString);
		insertFormerNameValues.push(previousName.name);
		insertFormerNameValues.push(previousName.player);
		if(insertFormerNameSql.length >= config.recordsAtATime){
			executeQuery(insertFormerNameSql.slice(0), insertFormerNameValues.slice(0));
			insertFormerNameSql = [];
			insertFormerNameValues = [];
		};
	}
};

var createAchievements = function(currentPlayer){
	for(var i = 0, k = currentPlayer.achievements.length; i < k; i++){
		var achievement = currentPlayer.achievements[i];
		achievement.player = currentPlayer.name;
		var insertString = "";
		if(insertAchievementSql.length === 0){
			insertString = "INSERT INTO `tibiaapi`.`achievements` (`name`, `grade`, `secret`, `player`, `id`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, NULL, NOW(), NOW())";
		}else{
			insertString = ", (?, ?, ?, ?, NULL, NOW(), NOW())";
		}
		insertAchievementSql.push(insertString);
		insertAchievementValues.push(achievement.name);
		insertAchievementValues.push(achievement.grade);
		insertAchievementValues.push(achievement.secret);
		insertAchievementValues.push(achievement.player);
		if(insertAchievementSql.length >= config.recordsAtATime){
			executeQuery(insertAchievementSql.slice(0), insertAchievementValues.slice(0));
			insertAchievementSql = [];
			insertAchievementValues = [];
		};
	}
};

var createMurderers = function(currentDeath){ 
	for(var i = 0, k = currentDeath.murderers.length; i < k; i++){
		var murderer = currentDeath.murderers[i];
		murderer.murderId = currentDeath.murderId;
		var insertString = "";
		if(insertMurdererSql.length === 0){
			insertString = "INSERT INTO `tibiaapi`.`murderers` (`monster`, `character`, `participation`, `pvp`, `unknown`, `id`, `murderId`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, NULL, ?, NOW(), NOW())";
		}else{
			insertString = ", (?, ?, ?, ?, ?, NULL, ?, NOW(), NOW())";
		}
		insertMurdererSql.push(insertString);
		insertMurdererValues.push(murderer.monster);
		insertMurdererValues.push(murderer.character);
		insertMurdererValues.push(murderer.participation);
		insertMurdererValues.push(murderer.pvp);
		insertMurdererValues.push(murderer.unknown);
		insertMurdererValues.push(murderer.murderId);
		if(insertMurdererSql.length >= config.recordsAtATime){
			executeQuery(insertMurdererSql.slice(0), insertMurdererValues.slice(0));
			insertMurdererSql = [];
			insertMurdererValues = [];
		};
	}
};

var createDeaths = function(currentCharacter){
	for(var i = 0, k = currentCharacter.deaths.length; i < k; i++){
		var death = currentCharacter.deaths[i];
		death.player = currentCharacter.name;
		death.murderId = (""+death.level) + death.player + ("" + Math.floor(Math.random() * 99999999))
		var insertString = "";
		if(insertDeathSql.length === 0){
			insertString = "INSERT INTO `tibiaapi`.`deaths` (`date`, `level`, `murderId`, `murderercount`, `id`, `player`, `createdAt`, `updatedAt`) VALUES (NOW(), ?, ?, ?, NULL, ?, NOW(), NOW())";
		}else{
			insertString = ", (NOW(), ?, ?, ?, NULL, ?, NOW(), NOW())";
		}
		insertDeathSql.push(insertString);
		insertDeathValues.push(death.level);
		insertDeathValues.push(death.murderId);
		insertDeathValues.push(death.murderercount);
		insertDeathValues.push(death.player);
		createMurderers(death);
		if(insertDeathSql.length >= config.recordsAtATime){
			executeQuery(insertDeathSql.slice(0), insertDeathValues.slice(0));
			insertDeathSql = [];
			insertDeathValues = [];
		};
	}
};

var createPlayer = function(currentCharacter){
	//INSERT INTO `tibiaapi`.`players` (`name`, `sex`, `vocation`, `level`, `world`, `residence`, `lastlogin`, `accountstate`, `charcreated`, `comment`, `signature`, `creationDate`, `id`, `createdAt`, `updatedAt`) VALUES ('Shane', 'male', 'None', '1', 'Secura', 'Venore', '2014-03-15', 'free', '2014-03-15', 'comment', 'signature', '2014-03-14', '9000', '2014-03-22 08:56:36', '2014-03-22 08:56:36');
	var insertString = "";
	if(insertCharacterSql.length === 0){
		insertString = "INSERT INTO `tibiaapi`.`players` (`name`, `sex`, `vocation`, `level`, `world`, `residence`, `lastlogin`, `accountstate`, `charcreated`, `comment`, `signature`, `creationDate`, `id`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(), NOW())";
	}else{
		insertString = ", (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(), NOW())";
	}
	insertCharacterSql.push(insertString);
	insertCharacterValues.push(currentCharacter.name);
	insertCharacterValues.push(currentCharacter.sex);
	insertCharacterValues.push(currentCharacter.vocation);
	insertCharacterValues.push(currentCharacter.level);
	insertCharacterValues.push(currentCharacter.world);
	insertCharacterValues.push(currentCharacter.residence);
	insertCharacterValues.push(currentCharacter.lastlogin);
	insertCharacterValues.push(currentCharacter.accountstate);
	insertCharacterValues.push(currentCharacter.charcreated);
	insertCharacterValues.push(currentCharacter.comment);
	insertCharacterValues.push(currentCharacter.signature);
	insertCharacterValues.push(currentCharacter.creationDate);
	createDeaths(currentCharacter);
	createFormerNames(currentCharacter);
	createAchievements(currentCharacter);
	if(insertCharacterSql.length >= config.recordsAtATime){
		executeQuery(insertCharacterSql.slice(0), insertCharacterValues.slice(0), false, true);
		insertCharacterSql = [];
		insertCharacterValues = [];
	};
};


var start = process.hrtime();

var elapsed_time = function(note){
	if(silent) return;
	var precision = 3; // 3 decimal places
	var elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
	console.log("\n"+process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
};

var executeQuery = function(currentinsertCharacterSql, currentInsertValues, last, isCharacter, loudly){
	app.models.player.query(currentinsertCharacterSql.join(""), currentInsertValues, function(err, result){
		if(err) console.log("Error occured:", err);
		if(loudly){
			elapsed_time("Built and executed query - " + currentinsertCharacterSql.length + " rows");
		}
		if(isCharacter && !silent){
			charactersDone += currentinsertCharacterSql.length;
			var percentDone = Math.floor((charactersDone/characters)*10000)/100;
			var numGreen = Math.floor(percentDone/2);

			var black = "";
			var green = "";
			for(var i = 0; i < numGreen; i++){
				green += "=";
			}
			for(var i = 0, ii = 50-numGreen; i < ii; i++){
				black += "=";
			}

			var processedString = "["+clc.green(green)+clc.black(black)+"] " + percentDone.toFixed(2) + "%" + (done ? " (done processing)" : " (processing)"); 
			process.stdout.write(processedString + "\033[0G");
		}

		if(last){
			orm.teardown();
			elapsed_time("Whole file read and processed into database.");
		}
	});
};

function runProgram(){
	if(!silent){
		console.log("Reading file.");
	}
	
	linereader.eachLine('characters.xml', function(line, last){
		if(!inCharacter){
			//Not in a character, check to see if current line is a character
			if(line.indexOf("<character ") !== -1){
				characters++;
				inCharacter = true;
				currentCharacter = new character();
				for(var i = 0, propLength = characterProperties.length; i < propLength; i++){
					var prop = characterProperties[i];
					currentCharacter[prop] = line.getProperty(prop);
				}
			}
		}else if(inComment){
			commentArray.push("\n" + line);
			if(line.indexOf("</comment>") !== -1){
				inComment = false;
				currentCharacter.comment = commentArray.join("").replace("</comment>", "").trim();
				commentArray = [];
			}
		}else if(inSignature){
			signatureArray.push(line + "\n");
			if(line.indexOf("</signature>") !== -1){
				currentCharacter.signature = signatureArray.join("").replace("</signature>", "").trim();
				inSignature = false;
				signatureArray = [];
			}
		}else if(inDeath){
			if(line.indexOf("<murderer ") !== -1){
				currentDeath.murderers.push(new murdererObject(line));
			}
			if(line.indexOf("</death>") !== -1){
				inDeath = false;
				currentCharacter.deaths.push(currentDeath);
			}
		}else{
			if(line.indexOf("<comment>") !== -1){
				commentArray.push((line + "\n").replace("<comment>", ""));
				inComment = true;
				if(line.indexOf("</comment") !== -1){
					inComment = false;
					currentCharacter.comment = commentArray.join("").replace("</comment>", "").trim();
					commentArray = [];
				}
			}
			
			if(line.indexOf("<signature>") !== -1){
				signatureArray.push(line.replace("<signature>", ""));
				inSignature = true;
				if(line.indexOf("</signature>") !== -1){
					currentCharacter.signature = signatureArray.join("").replace("</signature>", "").trim();
					inSignature = false;
					signatureArray = [];
				}
			}
			
			if(line.indexOf("<death ") !== -1){
				inDeath = true;
				currentDeath = new deathObject(line);
				if(line.indexOf("</death>") !== -1){
					inDeath = false;
					currentCharacter.deaths.push(currentDeath);
				}
			}
			
			if(line.indexOf("<achievement ") !== -1){
				var newAchievement = new achievement(line);
				currentCharacter.achievements.push(newAchievement);
			}
			
			if(line.indexOf("<account ") !== -1){
				currentCharacter.creationDate = line.getProperty("creationdate");
			}

			if(line.indexOf("<formername ") !== -1){
				var newFormerName = new formerNameObject(line);
				currentCharacter.formerNames.push(newFormerName);
			}
		
			if(line.indexOf("</character>") !== -1){
				inCharacter = false;
				
				//Save previous player to database
				createPlayer(currentCharacter);
			}
		}
		
		lines++;
		if(last){
			elapsed_time("Read " + lines + " lines, parsed " + characters + " characters");
			executeQuery(insertCharacterSql.slice(0), insertCharacterValues.slice(0));
			insertCharacterSql = [];
			insertCharacterValues = [];
			executeQuery(insertDeathSql.slice(0), insertDeathValues.slice(0));
			insertDeathSql = [];
			insertDeathValues = [];
			executeQuery(insertAchievementSql.slice(0), insertAchievementValues.slice(0), false);
			insertAchievementSql = [];
			insertAchievementValues = [];
			executeQuery(insertFormerNameSql.slice(0), insertFormerNameValues.slice(0), false);
			insertFormerNameSql = [];
			insertFormerNameValues = [];
			executeQuery(insertMurdererSql.slice(0), insertMurdererValues.slice(0), true);
			insertMurdererSql = [];
			insertMurdererValues = [];
			done = true;
		}
	});
}
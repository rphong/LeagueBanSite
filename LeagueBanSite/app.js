import fetch from "node-fetch";
import fs from "fs";
import express from 'express';
import bodyParser from "body-parser";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

//variables
var riotKey;
var summonerName;
var banChampsData;
const totalEnemiesWin = new Map();
const totalEnemiesLose = new Map();

//getting dirname path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(__dirname);

//loading local host page and bodyparser
const app = express();
const port = 3000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.listen(port, () => console.info(`Listening on port ${port}`));

//Static files
app.use(express.static(__dirname + '/public'));

//Setting views
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

//initializing pages
app.get('', (req, res) => 
{
    return res.render('index');
})

app.get('/banPage', async (req, res) => 
{
    return res.render('banPage', {banChamps: await banChampsData});
})


//redirecting pages
app.post('/banPage', async (req, res) =>
{
    summonerName = req.body.summonerName;//input from user
    banChampsData = await main(getMatchList(getSummonerName(summonerName),"ranked"));
    //index 0 = SEO, 1 = SEL, 2 = most consistent
    return res.redirect('banPage');
})

app.post('/index', (req, res) =>
{
    return res.redirect('/');
})

//get key front txt file
try 
{
    const data = fs.readFileSync('LeagueBanWebsite\\riotKey.txt', "utf8");
    riotKey = data;
} 
catch (err) 
{
    console.error(err);
}

//main function
async function main(matchListT)
{
    const matchList = await matchListT;
    var strongestEnemyLane = "";
    var SELData;
    var SELGold = 0;//maybe use later? probably not
    var SELGoldRatio = 0;//(enemygold)/(playergold) * 100
    var SELGameNum;
    var SELN = 0;//participant number
    var SELMatchTime = 0;
    var SELKP = 0;
    var SELPlayer;

    //strongest enemy overall(O)
    var strongestEnemyO = "";
    var SENO = 0;
    var SEOData;
    var SEOGameNum;
    var SEOGoldRatio = 0;
    var SEOKP = 0;
    var SEOMatchTime = 0;
    var SEOPlayer;

    var currentPlayer;

    for(var i = 0;i < matchList.length;i++)//for each match
    {
        var side = "";
        var playerRole = "";
        var avgAllyGold = 0;
        var tempPlayerGold = 0;
        var tempEnemyGold = 0;
        var totalKills = 0;
        var SEN = 0;//participant number
        var SELFound = false;
        const res = await getMatch(matchList[i]);
        var gameDuration = res.info.gameDuration/60;

        //check every player to find side
        for(var x = 0;x < 10;x++)
        {
            let tempPlayer = res.info.participants[x];
            //adding each enemy to list of total champs
            if(summonerName === tempPlayer.summonerName)
            {
                side = (x > 4) ? "Red" : "Blue";
                currentPlayer = tempPlayer;
                playerRole = tempPlayer.teamPosition;
                tempPlayerGold = tempPlayer.goldEarned;
            }
        }

        //if blue side, allies are 0-4, enemies are 5-9
        if(side === "Blue")
        {
            //allies
            for(var playerNum = 0; playerNum < 5;playerNum++)
            {
                let tempAlly = res.info.participants[playerNum];

                avgAllyGold += tempAlly.totalDamageDealtToChampions;
            }
            avgAllyGold /= 5;

            //enemies
            for(var playerNum = 5; playerNum < 10;playerNum++)
            {
                let tempEnemy = res.info.participants[playerNum];
                totalKills += tempEnemy.kills;

                assignEnemy(tempEnemy, tempEnemy.win); //assign enemy to their W/L numbers

                if(playerRole === tempEnemy.teamPosition)//finding enemy in same lane/role
                {
                    let tempGoldRatio = tempEnemy.goldEarned/tempPlayerGold * 100;
                    if(tempGoldRatio > SELGoldRatio)//new biggest ___ gap
                    {
                        SELFound = true;
                        strongestEnemyLane = tempEnemy.championName;
                        SELGoldRatio = tempGoldRatio;
                        SELGameNum = i;//number of games from most recent game
                        SELN = playerNum;
                        SELGold = tempEnemy.goldEarned;
                        SELData = tempEnemy;
                        SELMatchTime = gameDuration;
                    }//this takes care of the laner for every match since we only have to check one player and check with other games
                }

                else if(tempEnemyGold < tempEnemy.goldEarned)//finding enemy with most gold
                {
                    tempEnemyGold = tempEnemy.goldEarned;
                    SEN = playerNum;
                }//this only gets the strongest enemy from the match, after collecting data, keep this player to compare to future matches
            }
        }
        //else is red side, vice versa
        else
        {
            //allies
            for(var playerNum = 5; playerNum < 10;playerNum++)
            {
                let tempAlly = res.info.participants[playerNum];

                avgAllyGold += tempAlly.totalDamageDealtToChampions;
            }
            avgAllyGold /= 5;

            //enemies
            for(var playerNum = 0; playerNum < 5;playerNum++)
            {
                let tempEnemy = res.info.participants[playerNum];
                totalKills += tempEnemy.kills;
                assignEnemy(tempEnemy, tempEnemy.win); //assign enemy to their W/L numbers

                if(playerRole === tempEnemy.teamPosition)//finding enemy in same lane/role
                {
                    let tempGoldRatio = tempEnemy.goldEarned/tempPlayerGold * 100;
                    if(tempGoldRatio > SELGoldRatio && tempEnemy.win)//new biggest ___ gap
                    {
                        SELFound = true;
                        strongestEnemyLane = tempEnemy.championName;
                        SELGoldRatio = tempGoldRatio;
                        SELGameNum = i;//number of games from most recent game
                        SELN = playerNum;
                        SELData = tempEnemy;
                        SELGold = tempEnemy.goldEarned;
                        SELMatchTime = gameDuration;

                    }//this takes care of the laner for every match since we only have to check one player and check with other games
                }                
            
                else if(tempEnemyGold < tempEnemy.goldEarned)//finding enemy with most gold
                {
                    tempEnemyGold = tempEnemy.goldEarned;
                    SEN = playerNum;
                }//this only gets the strongest enemy from the match, after collecting data, keep this player to compare to future matches
            }
        }

        //Get KP for SEL if new one is found
        if(SELFound)
        {
            let tempEnemy = res.info.participants[SELN];
            SELKP = (tempEnemy.kills + tempEnemy.assists)/totalKills * 100;
            SELKP = SELKP.toFixed(0);
            SELPlayer = currentPlayer;
        }

        //compare strongest enemy with other matches
        let tempEnemy = res.info.participants[SEN];
        if(playerRole === "UTILITY")
        {
            if(gameDuration >= 10 && gameDuration < 20)
                tempPlayerGold *= 1.25;
            if(gameDuration >= 20 && gameDuration < 30)
                tempPlayerGold *= 1.5;
            if(gameDuration >= 30 && gameDuration < 40)
                tempPlayerGold *= 1.75;
            if(gameDuration >= 40)
                tempPlayerGold *= 2;
        }

        let tempGoldRatio = tempEnemy.goldEarned/tempPlayerGold * 100;
        
        if(tempGoldRatio > SEOGoldRatio)//new SEO
        {
            strongestEnemyO = tempEnemy.championName;
            SEOGameNum = i;//add one later since it starts at 0
            SEOGoldRatio = tempGoldRatio;
            SENO = SEN;//participant number to check again later for stats
            SEOData = tempEnemy;
            SEOKP = (tempEnemy.kills + tempEnemy.assists)/totalKills * 100;
            SEOKP = SEOKP.toFixed(0);//removing decimals
            SEOMatchTime = gameDuration;
            SEOPlayer = currentPlayer;
        }
    }
    var MCE = findMostConsistentEnemy();//most consistent enemy
    let banChampsData = {SEOData, SELData, MCE, SEOGameNum, SELGameNum, SEOKP, SELKP, SEOMatchTime, SELMatchTime, SEOPlayer, SELPlayer};
    return banChampsData;
}

function assignEnemy(tempEnemy, win)//use foreach loop later to iterate through map
{
    if(win)//if the enemy won, add a win to their name
    {
        if(totalEnemiesWin.has(tempEnemy.championName))
            totalEnemiesWin.set(tempEnemy.championName, totalEnemiesWin.get(tempEnemy.championName) + 1);
        else
            totalEnemiesWin.set(tempEnemy.championName, 1);
    }
    else //else if lose, add loss to their name
    {
        if(totalEnemiesLose.has(tempEnemy.championName))
            totalEnemiesLose.set(tempEnemy.championName, totalEnemiesLose.get(tempEnemy.championName) + 1);
        else
            totalEnemiesLose.set(tempEnemy.championName, 1);
    }
    
    return 0;
}

function findMostConsistentEnemy()
{
    var mostConsistentEnemy = "";
    var highestWinRate = 0;
    var tempWinRate = 0;
    var mostGamesOneHundred = 0;//if winrate is 100% with at least 3 games, use this to start comparing
    var amountOfGames;
    totalEnemiesWin.forEach((value, key) => {
        if(!totalEnemiesLose.has(key) && value > 3)
        {
            if(value > mostGamesOneHundred)
            {
                mostConsistentEnemy = key;
                mostGamesOneHundred = value;
                amountOfGames = value;
                highestWinRate = 100;
            }
        }
        else if(highestWinRate != 100)
        {
            tempWinRate = value/((totalEnemiesLose.get(key) + value)) * 100;
            if(tempWinRate > highestWinRate)
            {
                highestWinRate = tempWinRate;
                mostConsistentEnemy = key;
                amountOfGames = value + totalEnemiesLose.get(key);
            }
        }
      });
    console.log(mostConsistentEnemy, highestWinRate, mostGamesOneHundred);
    return {mostConsistentEnemy, highestWinRate, amountOfGames};
}



//fetching stuff from api
async function getSummonerName(name)//fetch puuid
{
    const link = `https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}?api_key=${riotKey}`;
    const res = await fetch(link);  
    let data = await res.json();
    return data.puuid;
}

async function getMatchList(puuid, type)//get recent matches
{
    const link = `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${await puuid}/ids?type=${type}&start=0&count=20&api_key=${riotKey}`;
    const res = await fetch(link);
    let data = await res.json();
    return data;
}

async function getMatch(match)//get specific match
{
    const link = `https://americas.api.riotgames.com/lol/match/v5/matches/${await match}/?api_key=${riotKey}`;
    const res = await fetch(link);
    let data = await res.json();
    return data;
}
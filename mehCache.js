const fetch = require('node-fetch');
var conf = require('./lib/botconfig');

var mehItem;

function parseMehItem(mehItem) {

    var mehOutput = '';
    if (!mehItem) {
        return mehOutput;
    }

    try {
    mehOutput = mehItem.items[0].condition + ' ';
    mehOutput = mehItem.title + ', ';
    if (mehItem.soldOutAt == true) {
        mehOutput += 'SOLD OUT';
    } else {
        mehOutput += '$' + mehItem.items[0].price;
    }
    // if (mehItem.WootOff == true) {
    //     mehOutput += ', ';
    //     mehOutput += mehItem.SoldOutPercentage * 100 + '% Sold';
    // }
    mehOutput += ', ';
    mehOutput += mehItem.url;
    } catch (e) {
        console.error('Error building meh item output', e);
    }
    return mehOutput;
}

function refreshCache() {
    try {
    var mehApiKey = conf.MEH_API_KEY;
    fetch(`https://api.meh.com/1/current.json?apikey=${mehApiKey}`)
        .then(res => res.json())
        .then(json => mehItem = json.deal)
        .catch((err) => {
            console.error("Error loading meh item", err);
        });
    } catch (e) {
        console.error('Bigger error handling meh cache refresh', e);
    }
}

exports.getMehInfo = function() {
    return parseMehItem(mehItem);
}

refreshCache();
setInterval(function () {
    refreshCache()
}, 60000);
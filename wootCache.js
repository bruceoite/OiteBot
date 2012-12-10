var http = require('http');
var wootClient = http.createClient(80, 'api.woot.com');

var wootItem;
var shirtItem;
var sellOutItem;
var homeItem;
var kidsItem;
var wineItem;
var sportItem;
var techItem;

function refreshCache() {
    try {
        var request = wootClient.request("GET", "/1/sales/current.json", {
            "host": "api.woot.com"
        });
    
    
        request.addListener("response", function (response) {
            var body = "";

            response.addListener("data", function (data) {
                body += data;
            });

            response.addListener("end", function (end) {
                var wootItems = JSON.parse(body).sales;
                for(i in wootItems) {
                    var site = wootItems[i].SiteName;
                    switch(site) {
                        case('Woot'):
                            wootItem = wootItems[i];
                            break;
                        case('Shirt.Woot'):
                            shirtItem = wootItems[i];
                            break;
                        case('Home.Woot'):
                            homeItem = wootItems[i];
                            break;
                        case('Kids.Woot'):
                            kidsItem = wootItems[i];
                            break;
                        case('Wine.Woot'):
                            wineItem = wootItems[i];
                            break;
                        case('Sellout.Woot'):
                            sellOutItem = wootItems[i];
                            break;
                        case('Sport.Woot'):
                            sportItem = wootItems[i];
                            break;
                        case('Tech.Woot'):
                            techItem = wootItems[i];
                            break;
                    }
                }
            
            });
        });
        request.end();
    } catch(e) {
        
    }
}

function parseWootItem(wootItem) {
    if(wootItem) {
        var wootOutput = wootItem.Title + ', ';
        if(wootItem.SoldOut == true) {
            wootOutput += 'SOLD OUT';
        } else {
            wootOutput += wootItem.Price;
        }
        if(wootItem.WootOff == true) {
            wootOutput += ', ';
            wootOutput += wootItem.SoldOutPercentage * 100 + '% Sold';
        }
        wootOutput += ', '; 
        wootOutput += wootItem.SaleUrl;
        return wootOutput;
    } else {
        return '';
    }
}

exports.getWootInfo = function(wootSite) {
    if(wootSite) {
        switch(wootSite) {
            case('shirt'):
                return parseWootItem(shirtItem);
                break;
            case('home'):
                return parseWootItem(homeItem);
                break;
            case('kids'):
                return parseWootItem(kidsItem);
                break;
            case('wine'):
                return parseWootItem(wineItem);
                break;
            case('sellout'):
            case('deals'):
                return parseWootItem(sellOutItem);
                break;
            case('sport'):
                return parseWootItem(sportItem);
                break;
            case('tech'):
                return parseWootItem(techItem);
                break;
            default:
                return parseWootItem(wootItem);
                break;
        }
    }
}

refreshCache();
setInterval(function(){
    refreshCache()
}, 60000);

    
    

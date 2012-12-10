var queue = new Array();

exports.addUser = function (userName) {
    if(queue.indexOf(userName) < 0) {
        queue.push(userName);
    }
}

exports.removeUser = function (userName) {
    var userIndex = queue.indexOf(userName);
    if(userIndex >= 0) {
        queue.splice(userIndex, 1);
    }
}

exports.listQueue = function() {
    if(queue.length == 0) {
        return 'Queue is empty.';
    } else {
        return queue.join(", ");
    }
    
}

exports.clearQueue = function() {
    queue = new Array();
}

exports.isUserInQueue = function(userName) {
    return queue.indexOf(userName) >= 0;
}

exports.isUserNextInQueue = function(userName) {
    if(queue.length != 0) {
        return userName == queue[0];
    }
    return true;   
}


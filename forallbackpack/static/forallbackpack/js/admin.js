
// Generate a random token
function generateToken(length)
{
    var n = length || 50;
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i=0; i < n; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }    
    return text;
}

// Set the value of an element to a random token
function setTokenValue(elementId, tokenLength)
{
    var element = document.getElementById(elementId);
    element.value = generateToken(tokenLength);
}
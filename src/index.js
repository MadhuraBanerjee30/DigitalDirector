'use strict';
var request = require('request');
var admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");
//iframe link to the ppt in gslides
const iframePre = 'https://docs.google.com/a/pwc.com/presentation/d/e/2PACX-1vTxXUOcae5fO3GcQzNDAsW0wlujgQZ8mrKyH5zw3rr7xiFMSsDwjt0LZHW7teik2Ays6NmpDhFH70VR/embed?start=false&loop=false&delayms=3000&slide=id.p';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://maria-ppt-bot.firebaseio.com"
});

// Close dialog with the customer, reporting fulfillmentState of Failed or Fulfilled ("Thanks, your pizza will arrive in 20 minutes")
function close(sessionAttributes, fulfillmentState, message) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState: fulfillmentState,
            message: message,
        },
    };
}

//This function return which slide need to be displayed, if slide is not found error message will be display
function getSlideToDisplay(slideValue, callback) {
    var ref = admin.database().ref("presentation");
    ref.once("value", function (snapshot) {
        var isValid = false;
        var slideArray = snapshot.val();
        var arrayLength = slideArray.length;

        for (var index = 1; index < arrayLength; ++index) {
            var slide = slideArray[index];
            console.log('DDD' + JSON.stringify(slide))
            console.log('==' + slideValue)
            let slideNumber = isNaN(slideValue) ? slideValue : slideValue.toString()
            if (slide[0] == slideValue || (slide[1]).toLowerCase() == slideNumber) {
                isValid = true;
                callback(slideArray[index])
                break;
            }

        }
        if (!isValid) {
            callback({ error: 'no slides found' })
        }
    });
}

//This function update slide to display as per user request
function updateSlideToDisplay(slideValue, callback) {
    var slideToDisplay = 1;
    if (slideValue == 'PREVIOUS' || slideValue == 'NEXT') {
        //Get Current Slide
        var db = admin.database()
        var ref = db.ref("MasterSetup");
        ref.once("value", function (snapshot) {
            var slideData = snapshot.val();
            var currentSlide = slideData.pageToDisplay;
            var prevSlide = currentSlide;
            var slideLength = slideData.slides.length;

            if (slideValue == 'PREVIOUS') {
                currentSlide = currentSlide - 1;
            }
            else {
                currentSlide = currentSlide + 1;
            }
            if (currentSlide > 0 && currentSlide <= slideLength) {

                getSlideToDisplay(currentSlide + '', function (data) {

                    if (!data.error) {
                        //Get Current Slide
                        var dbs = admin.database()
                        var ref = dbs.ref("MasterSetup");
                        ref.update({ pageToDisplay: data.id });
                        callback(data);
                    }
                    else {
                        console.log('There is error');
                    }
                })
            }
            else {
                ref.update({ pageToDisplay: prevSlide });
                getSlideToDisplay(prevSlide + '', function (data) {

                    if (!data.error) {
                        ref.update({ pageToDisplay: data.id });
                        callback(data);
                    }
                    else {
                        console.log('There is error');
                        callback({ error: 'There is no slide to display' });
                    }
                })
            }
        }, function (errorObject) {

            console.log("The read failed: " + errorObject.code);
            callback({ error: errorObject });
        });
    }
    else {
        getSlideToDisplay(slideValue, function (data) {

            if (!data.error) {
                console.log('I am inside function'+JSON.stringify(data))

                var dbs = admin.database()
                var ref = dbs.ref("MasterSetup");
                ref.update({ pageToDisplay: data.id });
                callback(data);
            }
            else {
                //console.log('There is no slide to display');
                callback({ error: 'There is no slide to display' });
            }
        })
    }
}


async function dispatch(intentRequest, callback) {
    const sessionAttributes = intentRequest.sessionAttributes;
    console.log(typeof intentRequest);
    console.log('intent name is ' + intentRequest["currentIntent"]["name"]);
    var intentName = intentRequest["currentIntent"]["name"];

    switch (intentName) {
        case "HelloMaya":

            let speech = new Promise((resolve, request) => {
                updateSlideToDisplay(3, function (data) {
                    resolve(data)
                    console.log(JSON.stringify(data))
                })

            })

            let text = await speech;
            console.log(JSON.stringify(text));
            var message = {
                "contentType": "SSML",
                "content": text[3]
            }
            callback(close(sessionAttributes, 'Fulfilled', message))

            break;

        default:
            var message = {
                "contentType": "PlainText",
                "content": "Please try with some thing else"
            }
            callback(close(sessionAttributes, 'Fulfilled', message))

    }

}


// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {
    console.log('INPUT JSON' + JSON.stringify(event))
    try {
        dispatch(event,
            (response) => {
                callback(null, response);
            });
    } catch (err) {
        callback(err);
    }
};


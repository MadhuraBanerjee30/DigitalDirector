'use strict';
var request = require('request');
var admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");

//Initialize Firebase
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
    var db = admin.database()
    var ref = db.ref("presentation");
    ref.once("value", function (snapshot) {
        var isValid = false;
        var slideArray = snapshot.val();
        var arrayLength = slideArray.length;

        for (var index = 1; index < arrayLength; ++index) {
            var slide = slideArray[index];
            if (slide[0] == slideValue || (slide[1]).toLowerCase() == slideValue.toLowerCase()) {
                isValid = true;
                db.goOffline()  //Close the firebase connection
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
    var db = admin.database();
    if (slideValue == 'PREVIOUS' || slideValue == 'NEXT') {
        //Get Current Slide

        var ref = db.ref("MasterSetup");
        ref.once("value", function (snapshot) {
            var slideData = snapshot.val();
            var currentSlide = slideData.pageToDisplay;
            var prevSlide = currentSlide;
            var slideLength = slideData.slides.length;

            if (slideValue == 'PREVIOUS') {
                currentSlide = currentSlide - 1;
            }
            else if (slideValue == 'NEXT') {
                currentSlide = currentSlide + 1;
            }
            else if (slideValue == 'LAST') {
                currentSlide = slideLength;
            }
            if (currentSlide > 0 && currentSlide <= slideLength) {

                getSlideToDisplay(currentSlide + '', function (data) {

                    if (!data.error) {
                        //Get Current Slide
                        //var dbs = admin.database()
                        db.ref("MasterSetup").ref.update({ pageToDisplay: data[0] });
                        db.ref("MasterSetup").ref.update({ iframe: data[2] });
                        db.goOffline();
                        callback(data);
                    }
                    else {
                        console.log('There is error');
                    }
                })
            }
            else {
                db.ref.update({ pageToDisplay: prevSlide });
                getSlideToDisplay(prevSlide + '', function (data) {

                    if (!data.error) {
                        db.ref.update({ pageToDisplay: data[0] });
                        db.goOffline();
                        callback(data);
                    }
                    else {
                        db.goOffline();
                        callback({ error: 'There is no slide to display' });
                    }
                })
            }
        }, function (errorObject) {
            db.goOffline();
            callback({ error: JSON.stringify(errorObject) });
        });
    }
    else {
        getSlideToDisplay(slideValue, function (data) {

            if (!data.error) {
                let dbs = db.ref("MasterSetup");
                dbs.ref.update({ pageToDisplay: data[0] });
                dbs.ref.update({ iframe: data[2] });
                db.goOffline();
                callback(data);
            }
            else {
                db.goOffline();
                callback({ error: 'There is no slide to display' });
            }
        })
    }
}


//Handle All the Intent
async function dispatch(intentRequest, callback) {
    const sessionAttributes = intentRequest.sessionAttributes;
    var intentName = intentRequest["currentIntent"]["name"];
    switch (intentName) {
        case "NavigationIntent":

            let slots = intentRequest.currentIntent.slots;
            let slideToDisplay = 1;
            let ordinal = { FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5, SIXTH: 6, SEVENTH: 7, EIGHTH: 8, NINTH: 9, TENTH: 10 }

            if (slots.Tag) { slideToDisplay = slots.Tag }
            else if (slots.Ordinal) { slideToDisplay = slots.Ordinal }
            else if (slots.SlideNumber) { slideToDisplay = ordinal[slots.SlideNumber] }
            else if (slots.Navigation) { slideToDisplay = slots.Navigation }

            let speech = new Promise((resolve, reject) => {
                updateSlideToDisplay(slideToDisplay + '', function (data) {
                    if (!data.error) {
                        console.log('****' + JSON.stringify(data))
                        resolve(data)
                    }
                    else { reject(data) }
                })

            })

            let text = await speech;
            console.log('####' + JSON.stringify(text));
            if (!text.error) {
                var message = {
                    "contentType": "SSML",
                    "content": text[3].slice(1, -1).replace(/\\"/g, '"')
                }
            } else {
                var message = {
                    "contentType": "PlainText",
                    "content": text.error
                }
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
    context.callbackWaitsForEmptyEventLoop = false
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


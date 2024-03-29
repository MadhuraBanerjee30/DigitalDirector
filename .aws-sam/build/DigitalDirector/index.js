'use strict';
var request = require('request');
var admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");

//Initialize Firebase
if (admin.apps.length == 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://maria-ppt-bot.firebaseio.com"
    });
}
var db = admin.database()
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
function ConfirmIntent(sessionAttributes, fulfillmentState, message) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ConfirmIntent',
            fulfillmentState: fulfillmentState,
            message: message,
        },
    };
}

//This function return which slide need to be displayed, if slide is not found error message will be display
function getSlideToDisplay(slideValue, callback) {
    var ref = db.ref("presentation");
    ref.once("value", function (snapshot) {
        var isValid = false;
        var slideArray = snapshot.val();
        var arrayLength = slideArray.length;

        for (var index = 1; index < arrayLength; ++index) {
            var slide = slideArray[index];
            if (slide[0] == slideValue || (slide[1]).toLowerCase() == slideValue.toLowerCase()) {
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
    if (slideValue == 'PREVIOUS' || slideValue == 'NEXT' || slideValue == 'LAST') {
        //Get Current Slide

        var ref = db.ref("/");
        ref.once("value", function (snapshot) {
            var slideData = snapshot.val();
            var currentSlide = slideData.MasterSetup.pageToDisplay;
            var prevSlide = currentSlide;
            var slideLength = slideData.presentation.length - 1;

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
                        let dba = db.ref("MasterSetup");
                        dba.ref.update({ pageToDisplay: data[0], iframe: data[2] });
                        console.log("***iframe update1***" + data[2]);
                        callback(data);
                    }
                    else {
                        console.log('There is error');
                        callback({ error: 'There is error' })
                    }
                })
            }
            else {
                db.ref.update({ pageToDisplay: prevSlide });
                getSlideToDisplay(prevSlide + '', function (data) {

                    if (!data.error) {
                        let bd = db.ref("MasterSetup");
                        bd.ref.update({ pageToDisplay: data[0], iframe: data[2] });
                        console.log("***iframe update2***" + data[2]);
                        callback(data);
                    }
                    else {

                        callback({ error: 'There is no slide to display' });
                    }
                })
            }
        }, function (errorObject) {

            callback({ error: JSON.stringify(errorObject) });
        });
    }
    else {
        getSlideToDisplay(slideValue, function (data) {

            if (!data.error) {
                let dbs = db.ref("MasterSetup");
                dbs.ref.update({ pageToDisplay: data[0], iframe: data[2] });
                console.log("***iframe update3***" + data[2].toString());
                callback(data);
            }
            else {

                callback({ error: 'There is no slide to display' });
            }
        })
    }
}


//Handle All the Intent
async function dispatch(intentRequest, callback) {
    const sessionAttributes = intentRequest.sessionAttributes;
    let speechToText = '<speak>Sure</speak>';
    var intentName = intentRequest["currentIntent"]["name"];
    switch (intentName) {
        case "NavigationIntent":

            var slots = intentRequest.currentIntent.slots;
            let slideToDisplay = 1;
            let ordinal = { FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5, SIXTH: 6, SEVENTH: 7, EIGHTH: 8, NINTH: 9, TENTH: 10 }


            if (slots.Tag) {slideToDisplay = slots.Tag }
            else if (slots.Ordinal) { slideToDisplay = ordinal[slots.Ordinal] }
            else if (slots.SlideNumber) {
                slideToDisplay = slots.SlideNumber

                //In Testing
                let speech = new Promise((resolve, reject) => {
                    getSlideToDisplay(slideToDisplay, (data) => {
                        if (!data.error) {
                            resolve(data);
                        }
                        else {
                            reject(data);
                        }
                    })
                });

                let tts = await speech;
                console.log('$$$' + JSON.stringify(tts));
                if (!tts.error) {
                    var followUp = tts[1].trim().replace(/\\"/g, '"');
                    var message = {
                        "contentType": "SSML",
                        "content": 'Are you sure you want to go to ' + followUp + ' Slide?'
                    }
                } else {
                    var message = {
                        "contentType": "PlainText",
                        "content": tts.error
                    }
                }
                sessionAttributes.slideToDisplay = tts[1].trim().replace(/\\"/g, '"');
                callback(ConfirmIntent(sessionAttributes, 'Fulfilled', message))


            }
            else if (slots.Navigation) { slideToDisplay = slots.Navigation }

            console.log('***SLIDE TO DISPLAY****' + slideToDisplay)
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
                if (slots.Back === 'back' && (slots.Ordinal || slots.SlideNumber || slots.Tag || slots.Navigation)) {

                    var message = {
                        "contentType": "SSML",
                        "content": speechToText
                    }
                }
                else {
                    var message = {
                        "contentType": "SSML",
                        "content": text[3].trim().replace(/\\"/g, '"')
                    }
                }
            } else {
                var message = {
                    "contentType": "PlainText",
                    "content": text.error
                }

            }
            callback(close(sessionAttributes, 'Fulfilled', message))
            db.goOffline()
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
    context.callbackWaitsForEmptyEventLoop = false
    try {
        dispatch(event,
            (response) => {
                callback(null, response);
            });
    } catch (err) {
        callback(err);
    }
};


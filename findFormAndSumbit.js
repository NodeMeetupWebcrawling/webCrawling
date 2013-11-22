var phantom   = require('phantom');
var event     = require('events').EventEmitter;

/*
 * test form submition using phantomjs-node
 */


var formFinder = {
    __proto__: event.prototype,

    engine  : null,
    keyword : null,

    init: function(engine, keyword) {
        this.engine  = engine;
        this.keyword = keyword;

        console.log(this.engine, this.keyword)

        return this;
    },

    /*
     *
     */
    initPhantom: function() {
        var self = this;

        return phantom.create(function(ph){
            self.createPage(ph);
        });
    },

    /*
     *
     */
    createPage: function(ph) {
        var self = this;
        return ph.createPage(function(page) {

            if(page) {
                self.setUp(page);
                self.emit('hookup', {'ph': ph, 'page': page});
            } else {
                self.emit('error', {'code': 100, 'message': 'Failed to create phantom instance'});
            }
        });
    },

    /*
     *
     */
    setUp: function(page) {

        page.set('Referer', this.engine);
        page.set('settings.userAgent', 'Mozilla/5.0 (Windows NT 6.2) AppleWebKit/535.11 (KHTML, like Gecko) Chrome/17.0.963.12 Safari/535.11');
        page.set('settings.javascriptEnabled', true);
        page.set('settings.loadImages', true);
        page.set('cookiesFile', '/tmp/cookies.txt');

        page.set('onConsoleMessage', function (msg) {
            console.log(msg);
        });

        page.set('onError', function (msg, trace)  {
            console.log(msg, trace);
        });


        page.set('onResourceRequested', function (request) {
            // console.log('Request ' + JSON.stringify(request, undefined, 4));
        });

    },

    /*
     *
     */
    open: function(page) {
        var self = this;

        page.open(self.engine, function(status) {
            console.log("opened site? ", status);

            page.injectJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js', function() {
                if(status == "success") {
                    self.emit('pageOpened');
                } else {
                    self.emit('error', {'code': 200, 'message': 'page open failure'});
                }
            });
        });
    },

    /*
     *
     */
    findQueryFormAndSubmit: function(page) {
        var self = this;

        return page.evaluate(function(keyword) {

            console.log("Keyword", keyword);

            if(document.querySelector("input[name=q]")) {

                document.querySelector("input[name=q]").value = keyword;

                console.log("Form set to", document.querySelector("input[name=q]").value);

                if(document.forms[0]) {
                    var forms   = document.forms[0];
                    var newForm = document.createElement('form');
                    newForm.submit.apply(forms);
                    return true;
                }
            }

            return false;

        }, function(result) {

                console.log(result);

                if(result === true) {
                    self.emit('formSubmitted');
                }
                else if (result == false ) {
                    self.emit('error', {'code': 300, 'message': 'Cannot submit the form'});
                }
                else {
                    console.log("Oh dear");
                }

        }, this.keyword);
    },

    takeSnapShot: function(page) {
        page.render('./screen_shot.jpg', function takeScreenShot() {
            console.log("Render success");
            process.exit();
        });
    }
};

var engine   = process.argv[2] || "http://www.google.co.uk";
var keyword  = process.argv[3] || 'Apple';

var spook = formFinder.init(engine, keyword);
var ph    = null;
var page  = null;

spook.once('hookup', function(params) {
    ph   = params.ph;
    page = params.page;

    spook.open(page);
});

spook.on('pageOpened', function() {
    console.log("Page is open");
    //console.log("Captcha?", spook.hasCaptcha(page, selector));
    setTimeout(function() {
        spook.findQueryFormAndSubmit(page);
    }, 3000);
});

// form submitted signal
spook.on('formSubmitted', function() {
    setTimeout(function() {
       spook.takeSnapShot(page);
    }, 3000);
});

spook.on('error', function(error) {
    console.log(error);
});

spook.initPhantom();

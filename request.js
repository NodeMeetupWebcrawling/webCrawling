'use strict;'

var request      = require('request'),
    http         = require('http'),
    url          = require('url'),
    cheerio      = require('cheerio'),
    EventEmitter = require('events').EventEmitter;

var Request = {
    __proto__: EventEmitter.prototype,     // inherits from EventEmitter (just the 1 listener)
    debug: true,                           // debug true for console output
    timeout: 10000,                        // default request timeout
    internal_links: [],
    pending: [],
    seen: [],
    current: null,
    host: null,
    count: 0,

    init: function () { return this; },
    
     /*
     * Request, sends out initial hit to landing page.
     */
    request: function(host) {
        
       var self     = this,                   // maps to ourself
            options  = {                      // options for the request
                "uri"            : host,      // hostname to visit
                "timeout"        : 15000,     // initial timeout
                "maxRedirects"   : 2,         // max redirects allowed
                "followRedirect" : true,       // follow the redirects (if any) 
				"headers": {'user-agent': 'Mozilla/5.0'},
            },
            internals   = [],                 // internal links container
            masters     = [],                 // master backlinks container
            header_info = {},                 // page headers
            status_info = {},                 // page staus  
            status      = 0,                  // page response status  
            redirect    = {},                 // redirect container
            $           = null;               // maps to cheerio (jQuery on the server)  
        
        var page = host;           // url.parse is a handy feature (splits a url into its component parts)

        if(!this.host) {
            this.host = page;
        }

        // See request.js (full fetured http client, used for its follow redirects features)        
        var req = request(options, function (error, res, body) 
        {  

            self.count++;

            if(!error) {
                // Redirects found under this.redirects

                if (this.redirects.length > 0) 
                {
                    // build our redirect info
                    var re = this.redirects[this.redirects.length-1];
                    status   = re.statusCode;
                    redirect = {"status": re.statusCode, "location":re.redirectUri};      
                    page = url.parse(re.redirectUri);
                } 
                 else 
                {   // default status if no redirect
                    status = res.statusCode;
                    redirect = {"status": 0, "location":0}; 
                }
                
                // Parse our page body (emmits landing metrics)
                if(body && res.headers['content-type'].match(/(html|text|txt)/)) 
                {    // load the body into cheerio (jQuery on the server)
                     $ = cheerio.load(body, {lowerCaseTags:true, lowerCaseAttributeNames: true});

                     // map appears to have a better time than doing a 
                     // $('a').each()
                     var hrefs = $('a[href^="http://'+page.host+'"], a[href^="https://'+page.host+'"], a[href^="/"],a[href^="."]').map(function(i, el) {
                        if(!(/\.(pdf|PDF|jpg|JPG|doc|DOC|avi|AVI|mov|MOV|mpg|MPG|tiff|TIFF|zip|ZIP|tgz|TGZ|xml|XML|xml|XML|rss|RSS|mp3|MP3|ogg|OGG|wav|WAV|rar|RAR)$/i).test($(this).attr('href'))) {
                            if($(this).attr('href').length > 0) {
                               return url.resolve(self.host, $(this).attr('href'));
                            }
                        }
                     }).join('::-::');   

                     internals = hrefs.split('::-::'); 
                     
                     // remove duplicates
                     internals = internals.filter(function(elem, pos) {
                       return internals.indexOf(elem) == pos;
                     });
                     
                     // remove undersired links
                     internals = internals.filter(function(elem, pos) {
                       return !(/^(javascript|mail|#)/).test(pos);
                     });

                    for(var i in internals) {
                        var link = internals[i];
                        if(self.pending.indexOf(link) === -1 && self.seen.indexOf(link) === -1) {
                           self.pending.push(link);
						}	
                    }
                } else {
                    self.emit('stop', {"error": res.headers['content-type']}, null);
                }

                // we only want a hundred
                if(internals.length > 100) {
                    internals = internals.splice(0, 99);
                }
                
                // Emit our results
                if(status && internals) 
                {   
                    var data = {                     // build up our output (json please)
                       "host"      : host,           // hostname 
                       "status"    : status,         // status
                       "redirect"  : redirect       // redirect info
                      // "internals" : internals       // internal links
                    };
                    
                    // status < 400 success || error
                    (status < 400) ? self.emit('stop', null, data) : self.emit('stop', {"error": status}, null);
                }   
            } else {
                
               self.emit('stop', {"error": error.code}, null);   
            }
        });

        // Any request errors then fail and move on
        req.on('error', function(error) {
           self.emit('stop', {"error": error}, null);              
        });
    }
};


var Req = Request.init();

// As we inherited eventemmiter we can simply call Req.on
// This simply sits tight and waits for a stop event to fire
Req.on('stop', function(err, data) {
    if(!err) {
        console.log(Req.count, "data", data);
    } else {
      console.log("Whoops", err);
	}

    var next = Req.pending.pop();

    if(!next || !next.length > 1) {
        next = Req.pending.pop();
    }

    Req.seen.push(next);

    setTimeout(function() {
        Req.request(next);
    }, 1000);
    
});

Req.request('http://www.moneysupermarket.com');

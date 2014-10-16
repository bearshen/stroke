// Doodle file
var doodle = {
    photo: null,
    canvas: null,
    socket: null,
    width: null,
    height: null,
    pullqueue: null,

    pen_attributes : {
        thickness: 1,
        color: "#ff887c"
    },
    init: function(photo, canvas, socket) {
        this.photo = photo;
        this.canvas = canvas;
        if (!photo || !canvas) {
            console.log('Failed to grab photo and canvas');
        }
        if (!socket) {
            console.log('Failed to get socket');
        }
        this.width = canvas.width;
        this.height = canvas.height;


        this.clearEventListeners();

        // get initial data
        this.fullsync(socket);
        this.setupPullQueueTimeTrigger();
        this.registerStrokeListener();
        this.registerContentSyncer(socket);

    },

    fullsync: function(socket) {

    },

    setupPullQueueTimeTrigger: function() {
    },

    clearEventListeners: function() {
    },

    registerStrokeListener: function() {
    },

    registerContentSyncer: function(socket) {
    },

    parameterize: function(data){
        if (data.x.length != data.y.length || data.x.length != data.ts.length) {
            return null;
        }
        tmp = data;
        for (var i = 0; i < tmp.x.length; ++i) {
            tmp.x[i] /= this.width;
            tmp.y[i] /= this.height;
        }
        for (var i = tmp.ts.length-1; i > 0; --i) {
            tmp.ts[i] -= tmp.ts[i-1];
        }
        tmp.ts[0] = 0;
        return tmp;
    },

    deparameterize: function(data){
        if (data.x.length != data.y.length || data.x.length != data.ts.length) {
            return null;
        }
        tmp = data;
        for (var i = 0; i < tmp.x.length; ++i) {
            tmp.x = new Array();
            tmp.y = new Array();
            tmp.x[i] *= Math.round(this.width);
            tmp.y[i] /= Math.round(this.height);
        }
        return tmp;
    }


    /*
     client send stroke:
     sends = {color, x, y, ts};  // ts[0] is guaranteed to be 0.
     recvs = {token} // token being the ts of server.
     */

    /*
     client receives stroke:
     recvs = {color, x, y, ts, token};
     sends = {token}
     */
    sendstroke: function(socket, data) {

    },

    draw: function(hdata) {
        // currently we are not optimizing, we need to optimize before use.
        data = this.deparameterize(hdata);
        if (data.x.length != data.y.length || data.x.length != data.ts.length) {
            return null;
        }
    }


}
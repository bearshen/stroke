/*!
 * Signature Pad v1.3.2
 * https://github.com/szimek/signature_pad
 *
 * Copyright 2013 Szymon Nowak
 * Released under the MIT license
 *
 * The main idea and some parts of the code (e.g. drawing variable width Bézier curve) are taken from:
 * http://corner.squareup.com/2012/07/smoother-signatures.html
 *
 * Implementation of interpolation using cubic Bézier curves is taken from:
 * http://benknowscode.wordpress.com/2012/09/14/path-interpolation-using-cubic-bezier-and-control-point-estimation-in-javascript
 *
 * Algorithm for approximated length of a Bézier curve is taken from:
 * http://www.lemoda.net/maths/bezier-length/index.html
 *
 */
var DrawPad = (function (document) {
    "use strict";

    var DrawPad = function (canvas, options) {
        var opts = options || {};

        this.velocityFilterWeight = opts.velocityFilterWeight || 0.7;

        this.currentDotSize = opts.currentDotSize || 1.5;
        this.currentMinWidth = this.currentDotSize - 0.7;
        this.currentMaxWidth = this.currentDotSize + 0.7;
        this.currentPenColor = opts.currentPenColor || "black";
        this.backgroundColor = "rgba(0,0,0,0)";
        this.onEnd = opts.onEnd;
        this.onBegin = opts.onBegin;
        this._canvas = canvas;
        this._ctx = canvas.getContext("2d");
        this.strokes = new Array();
        this.stroke = {pts:new Array()};
        this.virtualpoints = new Array();
        this.clear();

        this._handleMouseEvents();
        this._handleTouchEvents();
        this.ready = true;
    };

    DrawPad.prototype.onChangePenColor = function(pencolor) {
        this.currentPenColor = pencolor || "black";
        this._reset();
    };

    DrawPad.prototype.onSave = function() {

    }
    DrawPad.prototype.onUndo = function() {

    }
    DrawPad.prototype.onChangeDotSize = function(dotsize) {
        this.currentDotSize = dotsize || 1.5;
        this.currentMinWidth = this.currentDotSize - 0.7;
        this.currentMaxWidth = this.currentDotSize + 0.7;
        this._reset();
    }

    DrawPad.prototype.clear = function () {
        var ctx = this._ctx,
            canvas = this._canvas;
        this.strokes = [];
        ctx.fillStyle = this.backgroundColor;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        this._reset();
    };
    DrawPad.prototype.onReceiveData = function(data) {
        // does nothing
        return JSON.parse(data.data);
    };
    DrawPad.prototype._addVirtualPoint = function (point) {
        var points = this.virtualpoints,
            c2, c3,
            curve, tmp;
        points.push(point);
        if (points.length > 2) {
            // To reduce the initial lag make it work with 3 points
            // by copying the first point to the beginning.
            if (points.length === 3) {points.unshift(points[0]);}

            tmp = this._calculateCurveControlPoints(points[0], points[1], points[2]);
            c2 = tmp.c2;
            tmp = this._calculateCurveControlPoints(points[1], points[2], points[3]);
            c3 = tmp.c1;
            curve = new Bezier(points[1], c2, c3, points[2]);
            this._addCurve(curve);

            // Remove the first element from the list,
            // so that we always have no more than 4 points in points array.
            points.shift();
        }
    };
    DrawPad.prototype.drawAndWait = function(points, i) {
        var len = points.length;
        this._addVirtualPoint(points[i]);
        if (i+1 >= len) {
            var canDrawCurve = this.points.length > 2,
            point = this.points[0];

            if (!canDrawCurve && point) {
                this._strokeDraw(point);
            }
            this._reset();
            return;
        };
        setTimeout( this.drawAndWait(points, i+1), (points[i+1].time - points[i].time));
    };
    DrawPad.prototype.onRedrawStroke = function(points, pencolor, dotsize) {
        this._reset();
        if (points) {
            var tmpPenColor = this.currentPenColor;
            var tmpDotSize = this.currentDotSize;
            this.onChangePenColor(pencolor);
            this.onChangeDotSize(dotsize);
            this.drawAndWait(points, 0);
            this.currentPenColor = tmpPenColor;
            this.currentDotSize = tmpDotSize;
        }
    };
    DrawPad.prototype.onRedrawStrokes = function (strokes) {
        for (var i = 0; i < strokes.length; ++i) {
            var tmp = this.onReceiveData(strokes[i]);
            var points = this.expandPoint(tmp['pts']);
            this.onRedrawStroke(points,tmp['color'], tmp['dotsize'] );
        }
    };
    DrawPad.prototype.expandPoint = function(tmp) {
        var ret = new Array();
        ret.push(new Point(tmp[0][0], tmp[0][1], tmp[0][2]))
        for (var i = 1; i < tmp.length; ++i){
            ret.push(new Point(tmp[i][0], tmp[i][1], ret[i-1].time + tmp[i][2]));
        }
        return ret;
    };
    DrawPad.prototype.onSaveStroke = function(stroke) {
        if (stroke) {
            this.strokes.push(stroke);
        }
    };

    DrawPad.prototype.onExportStrokes = function() {
        return this.strokes;
    }

    DrawPad.prototype._strokeUpdate = function (event) {
        var point = this._createPoint(event);
        this._addPoint(point);
    };

    DrawPad.prototype._strokeBegin = function (event) {
        this._reset();
        this.stroke.color = this.currentPenColor;
        this.stroke.dotsize = this.currentDotSize;
        this._strokeUpdate(event);
        if (typeof this.onBegin === 'function') {
            this.onBegin(event);
        }
    };

    DrawPad.prototype._strokeDraw = function (point) {
        var ctx = this._ctx,
            currentDotSize = typeof(this.currentDotSize) === 'function' ? this.currentDotSize() : this.currentDotSize;

        ctx.beginPath();
        this._drawPoint(point.x, point.y, currentDotSize);
        ctx.closePath();
        ctx.fill();
    };

    DrawPad.prototype._strokeEnd = function (event) {
        var canDrawCurve = this.points.length > 2,
            point = this.points[0];
        for(var i = this.stroke.pts.length; i > 1; --i) {
            this.stroke.pts[i-1][2] = this.stroke.pts[i-1][2] - this.stroke.pts[i-2][2];
        }
        this.stroke.pts[0][2] = 0;
        this.strokes.push(this.stroke);

        if (!canDrawCurve && point) {
            this._strokeDraw(point);
        }

        if (typeof this.onEnd === 'function') {
            this.onEnd(event);
        }
    };

    DrawPad.prototype._handleMouseEvents = function () {
        var self = this;
        this._mouseButtonDown = false;

        this._canvas.addEventListener("mousedown", function (event) {
            if (event.which === 1) {
                self._mouseButtonDown = true;
                self._strokeBegin(event);
            }
        });

        this._canvas.addEventListener("mousemove", function (event) {
            if (self._mouseButtonDown) {
                self._strokeUpdate(event);
            }
        });

        document.addEventListener("mouseup", function (event) {
            if (event.which === 1 && self._mouseButtonDown) {
                self._mouseButtonDown = false;
                self._strokeEnd(event);
            }
        });
    };

    DrawPad.prototype._handleTouchEvents = function () {
        var self = this;

        // Pass touch events to canvas element on mobile IE.
        this._canvas.style.msTouchAction = 'none';

        this._canvas.addEventListener("touchstart", function (event) {
            var touch = event.changedTouches[0];
            self._strokeBegin(touch);
        });

        this._canvas.addEventListener("touchmove", function (event) {
            // Prevent scrolling.
            event.preventDefault();

            var touch = event.changedTouches[0];
            self._strokeUpdate(touch);
        });

        document.addEventListener("touchend", function (event) {
            var wasCanvasTouched = event.target === self._canvas;
            if (wasCanvasTouched) {
                self._strokeEnd(event);
            }
        });
    };

    DrawPad.prototype.isEmpty = function () {
        return this._isEmpty;
    };

    DrawPad.prototype._reset = function () {
        this.points = [];
        this.stroke.pts = [];
        this.virtualpoints = [];
        this._lastVelocity = 0;
        this._lastWidth = (this.currentMinWidth + this.currentMaxWidth) / 2;
        this._isEmpty = true;
        this._ctx.fillStyle = this.currentPenColor;
    };

    DrawPad.prototype._createPoint = function (event) {
        var rect = this._canvas.getBoundingClientRect();
        return new Point(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
    };

    DrawPad.prototype._addPoint = function (point) {
        var points = this.points,
            c2, c3,
            curve, tmp;

        points.push(point);
        var d = new Date();
        var ts = d.getTime();
        this.stroke.pts.push([point.x, point.y, point.time]);

        if (points.length > 2) {
            // To reduce the initial lag make it work with 3 points
            // by copying the first point to the beginning.
            if (points.length === 3) points.unshift(points[0]);

            tmp = this._calculateCurveControlPoints(points[0], points[1], points[2]);
            c2 = tmp.c2;
            tmp = this._calculateCurveControlPoints(points[1], points[2], points[3]);
            c3 = tmp.c1;
            curve = new Bezier(points[1], c2, c3, points[2]);
            this._addCurve(curve);

            // Remove the first element from the list,
            // so that we always have no more than 4 points in points array.
            points.shift();
        }
    };


    DrawPad.prototype._calculateCurveControlPoints = function (s1, s2, s3) {
        var dx1 = s1.x - s2.x, dy1 = s1.y - s2.y,
            dx2 = s2.x - s3.x, dy2 = s2.y - s3.y,

            m1 = {x: (s1.x + s2.x) / 2.0, y: (s1.y + s2.y) / 2.0},
            m2 = {x: (s2.x + s3.x) / 2.0, y: (s2.y + s3.y) / 2.0},

            l1 = Math.sqrt(dx1*dx1 + dy1*dy1),
            l2 = Math.sqrt(dx2*dx2 + dy2*dy2),

            dxm = (m1.x - m2.x),
            dym = (m1.y - m2.y),

            k = l2 / (l1 + l2),
            cm = {x: m2.x + dxm*k, y: m2.y + dym*k},

            tx = s2.x - cm.x,
            ty = s2.y - cm.y;

        return {
            c1: new Point(m1.x + tx, m1.y + ty),
            c2: new Point(m2.x + tx, m2.y + ty)
        };
    };

    DrawPad.prototype._addCurve = function (curve) {
        var startPoint = curve.startPoint,
            endPoint = curve.endPoint,
            velocity, newWidth;

        velocity = endPoint.velocityFrom(startPoint);
        velocity = this.velocityFilterWeight * velocity
            + (1 - this.velocityFilterWeight) * this._lastVelocity;

        newWidth = this._strokeWidth(velocity);
        this._drawCurve(curve, this._lastWidth, newWidth);

        this._lastVelocity = velocity;
        this._lastWidth = newWidth;
    };

    DrawPad.prototype._drawPoint = function (x, y, size) {
        var ctx = this._ctx;

        ctx.moveTo(x, y);
        ctx.arc(x, y, size, 0, 2 * Math.PI, false);
        this._isEmpty = false;
    };

    DrawPad.prototype._drawCurve = function (curve, startWidth, endWidth) {
        var ctx = this._ctx,
            widthDelta = endWidth - startWidth,
            drawSteps, width, i, t, tt, ttt, u, uu, uuu, x, y;
        drawSteps = Math.floor(curve.length());
        ctx.beginPath();
        for (i = 0; i < drawSteps; i++) {
            // Calculate the Bezier (x, y) coordinate for this step.
            t = i / drawSteps;
            tt = t * t;
            ttt = tt * t;
            u = 1 - t;
            uu = u * u;
            uuu = uu * u;

            x = uuu * curve.startPoint.x;
            x += 3 * uu * t * curve.control1.x;
            x += 3 * u * tt * curve.control2.x;
            x += ttt * curve.endPoint.x;

            y = uuu * curve.startPoint.y;
            y += 3 * uu * t * curve.control1.y;
            y += 3 * u * tt * curve.control2.y;
            y += ttt * curve.endPoint.y;

            width = startWidth + ttt * widthDelta;
            this._drawPoint(x, y, width);
        }
        ctx.closePath();
        ctx.fill();
    };

    DrawPad.prototype._strokeWidth = function (velocity) {
        return Math.max(this.currentMaxWidth / (velocity + 1), this.currentMinWidth);
    };


    var Point = function (x, y, time) {
        this.x = x;
        this.y = y;
        this.time = time || new Date().getTime();
    };

    Point.prototype.velocityFrom = function (start) {
        return (this.time !== start.time) ? this.distanceTo(start) / (this.time - start.time) : 1;
    };

    Point.prototype.distanceTo = function (start) {
        return Math.sqrt(Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2));
    };

    var Bezier = function (startPoint, control1, control2, endPoint) {
        this.startPoint = startPoint;
        this.control1 = control1;
        this.control2 = control2;
        this.endPoint = endPoint;
    };

    // Returns approximated length.
    Bezier.prototype.length = function () {
        var steps = 10,
            length = 0,
            i, t, cx, cy, px, py, xdiff, ydiff;

        for (i = 0; i <= steps; i++) {
            t = i / steps;
            cx = this._point(t, this.startPoint.x, this.control1.x, this.control2.x, this.endPoint.x);
            cy = this._point(t, this.startPoint.y, this.control1.y, this.control2.y, this.endPoint.y);
            if (i > 0) {
                xdiff = cx - px;
                ydiff = cy - py;
                length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
            }
            px = cx;
            py = cy;
        }
        return length;
    };

    Bezier.prototype._point = function (t, start, c1, c2, end) {
        return          start * (1.0 - t) * (1.0 - t)  * (1.0 - t)
            + 3.0 *  c1    * (1.0 - t) * (1.0 - t)  * t
            + 3.0 *  c2    * (1.0 - t) * t          * t
            +        end   * t         * t          * t;
    };

    return DrawPad;
})(document);

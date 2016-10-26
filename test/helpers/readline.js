"use strict";
var EventEmitter = require("events").EventEmitter;
var sinon = require("sinon");
var util = require("util");
var _ = require("lodash");

var stub = {};

_.extend(stub, {
    write: sinon.stub().returns(stub),
    moveCursor: sinon.stub().returns(stub),
    setPrompt: sinon.stub().returns(stub),
    close: sinon.stub().returns(stub),
    pause: sinon.stub().returns(stub),
    resume: sinon.stub().returns(stub),
    _getCursorPos: sinon.stub().returns({
        cols: 0,
        rows: 0
    }),
    output: {
        end: sinon.stub(),
        mute: sinon.stub(),
        unmute: sinon.stub(),
        __raw__: "",
        write: function(str) {
            this.__raw__ += str;
        },
        clear: function() {
            this.__raw__ = "";
        }
    }
});

var ReadlineStub = function() {
    this.line = "";
    this.input = new EventEmitter();
    EventEmitter.apply(this, arguments);
};

util.inherits(ReadlineStub, EventEmitter);
_.assign(ReadlineStub.prototype, stub);

ReadlineStub.prototype.keyPress = function(letter) {
    this.output.clear();
    this.input.emit("keypress", letter, {
        name: letter
    });
};
ReadlineStub.prototype.sendWord = function(word) {
    word = word || "";
    word.split("").forEach(function(letter) {
        this.keyPress(letter);
    }, this);
};
ReadlineStub.prototype.moveDown = function() {
    this.output.clear();
    this.input.emit("keypress", "", {
        name: "down"
    });
};
ReadlineStub.prototype.moveUp = function() {
    this.output.clear();
    this.input.emit("keypress", "", {
        name: "up"
    });
};
ReadlineStub.prototype.enter = function() {
    this.output.clear();
    this.emit("line");
};


module.exports = ReadlineStub;

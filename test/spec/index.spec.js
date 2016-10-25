"use strict";

var expect = require('chai').expect;
var mock = require('mock-fs');
var ReadlineStub = require('../helpers/readline');
var Prompt = require('../../src/index');
var path = require('path');

describe('inquirer-directory', function() {

    before(function() {
        mock({
            'root': {
                '.git': {},
                'folder1': {
                    'folder1-1': {}
                },
                'folder2': {},
                'zfolder2': {},
                'some.png': new Buffer([8, 6, 7, 5, 3, 0, 9]),
                'a-symlink': mock.symlink({
                    path: 'folder1'
                })
            }
        });
    });

    after(mock.restore);

    beforeEach(function() {
        // need to clear "console after every action"
        this.rl = new ReadlineStub();
        this.prompt = new Prompt({
            message: 'Choose a directory',
            name: 'name',
            basePath: "./root/"
        }, this.rl);
    });
    afterEach(function() {
        this.rl.output.clear();
    });
    it('requires a basePath', function() {
        expect(function() {
            new Prompt({
                message: 'foo',
                name: 'name'
            });
        }).to.throw(/basePath/);
    });

    it('should list folders', function() {
        this.prompt.run();
        expect(this.rl.output.__raw__).to.contain('folder1');
        expect(this.rl.output.__raw__).to.contain('folder2');
        expect(this.rl.output.__raw__).to.contain('zfolder2');
    });

    it('should not contain folders starting with "." (private folders)', function() {
        this.prompt.run();
        expect(this.rl.output.__raw__).to.not.contain('.git');
    });

    it('should not contain files', function() {
        this.prompt.run();
        expect(this.rl.output.__raw__).to.not.contain('some.png');
    });

    it('should allow users to drill into folder', function() {
        this.prompt.run();
        this.rl.moveDown();
        this.rl.moveDown();
        this.rl.enter();
        expect(this.rl.output.__raw__).to.contain('folder1-1');
    });

    it('should allow users to go back after drilling', function() {
        this.prompt.run();
        this.rl.moveDown();
        this.rl.moveDown();
        this.rl.enter();
        expect(this.rl.output.__raw__).to.contain('..');
        this.rl.moveDown();
        expect(this.rl.output.__raw__).to.not.contain('zfolder2');
        this.rl.enter();
        expect(this.rl.output.__raw__).to.contain('zfolder2');
    });
    //
    it('should allow users to go past basePath', function() {
        this.prompt.run();
        this.rl.moveDown();
        this.rl.enter();
        expect(this.rl.output.__raw__).to.contain('..');
        expect(this.prompt.opt.choices.realChoices[1].name).to.equal('..');
    });

    it('should not display back option in root folder', function () {
        this.prompt.run();
        while (this.prompt.currentPath !==  path.parse(path.resolve('.')).root) {
            this.rl.moveDown();
            this.rl.enter();
        }
        expect(this.rl.output.__raw__).to.not.contain('..');
    });
    it('should allow users to go back using "-" shortcut', function() {
        this.prompt.run();
        expect(this.rl.output.__raw__).to.contain('zfolder2');
        this.rl.keyPress('-');
        expect(this.rl.output.__raw__).to.contain('..');
        expect(this.rl.output.__raw__).to.not.contain('zfolder2');
    });
    
    it('should allow users search for a folder using "/" shortcut', function() {
        this.prompt.run();
        expect(this.rl.output.__raw__).to.not.contain('Search:');
        this.rl.keyPress('/');
        var raw = this.rl.output.__raw__.replace('❯', '>');
        expect(raw).to.not.contain('> folder1');
        expect(this.rl.output.__raw__).to.contain('Search:');
        this.rl.keyPress('f');

        raw = this.rl.output.__raw__.replace('❯', '>');
        expect(raw).to.have.string('> folder1');
        this.rl.sendWord('older2');
        raw = this.rl.output.__raw__.replace('❯', '>');
        expect(raw).to.contain('> folder2');
    });
    // it('should allow users to press keys to shortcut to that value', function (done) {
    //     prompt.run(function (answer) {
    //       expect(answer).to.equal('zfolder2');
    //       done();
    //     });
    //     keyPress('z');
    //     enter();
    //     enter();
    // });

});
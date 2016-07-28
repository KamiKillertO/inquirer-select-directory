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
                name: 'name',
            });
        }).to.throw(/basePath/);
    });

    it('should list folders', function() {
        this.prompt.run();
        expect(this.rl.output.__raw__).to.contain('folder1');
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
        this.rl.enter();
        expect(this.rl.output.__raw__).to.contain('folder1-1');
    });

    it('should allow users to go back after drilling', function() {
        this.prompt.run();
        this.rl.enter();
        expect(this.rl.output.__raw__).to.contain('..');
        this.rl.output.clear();
        this.rl.moveDown();
        this.rl.enter();
        expect(this.rl.output.__raw__).to.contain('zfolder2');
    });

    it('should allow users to go past basePath', function() {
        this.prompt.run();
        this.rl.enter();
        expect(this.rl.output.__raw__).to.contain('..');
        expect(this.prompt.opt.choices.realChoices[0].name).to.equal('..');
    });

    it('should not display back option in root folder', function () {
        this.prompt.run();
        while (this.prompt.currentPath !==  path.parse(path.resolve('.')).root) {
            this.rl.output.clear();
            this.rl.enter();
        }
        expect(this.rl.output.__raw__).to.not.contain('..');
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
"use strict";

var expect = require("chai").expect;
var mock = require("mock-fs");
var ReadlineStub = require("../helpers/readline");
var Prompt = require("../../src/index");
var path = require("path");
var figures = require("figures");

describe("inquirer-directory", function () {

  describe('basic feature', function () {

    before(function () {
      mock({
        "root": {
          ".git": {},
          "folder1": {
            "folder1-1": {}
          },
          "folder2": {},
          "zfolder2": {},
          "some.png": new Buffer([8, 6, 7, 5, 3, 0, 9]),
          "a-symlink": mock.symlink({
            path: "folder1"
          })
        }
      });
    });

    after(mock.restore);

    beforeEach(function () {
      // need to clear "console after every action"
      this.rl = new ReadlineStub();
      this.prompt = new Prompt({
        message: "Choose a directory",
        name: "name",
        basePath: "./root/"
      }, this.rl);
    });

    afterEach(function () {
      this.rl.output.clear();
    });

    it("requires a basePath", function () {
      expect(function () {
        new Prompt({
          message: "foo",
          name: "name"
        });
      }).to.throw(/basePath/);
    });

    it("should list folders", function () {
      this.prompt.run();
      expect(this.rl.output.__raw__).to.contain("folder1");
      expect(this.rl.output.__raw__).to.contain("folder2");
      expect(this.rl.output.__raw__).to.contain("zfolder2");
    });

    it("should not contain folders starting with '.' (private folders)", function () {
      this.prompt.run();
      expect(this.rl.output.__raw__).to.not.contain(".git");
    });

    it("should not contain files", function () {
      this.prompt.run();
      expect(this.rl.output.__raw__).to.not.contain("some.png");
    });

    it("should allow users to drill into folder", function () {
      this.prompt.run();
      this.rl.moveDown();
      this.rl.moveDown();
      this.rl.enter();
      expect(this.rl.output.__raw__).to.contain("folder1-1");
    });

    it("should allow users to go back after drilling", function () {
      this.prompt.run();
      this.rl.moveDown();
      this.rl.moveDown();
      this.rl.enter();
      expect(this.rl.output.__raw__).to.contain("..");
      this.rl.moveDown();
      expect(this.rl.output.__raw__).to.not.contain("zfolder2");
      this.rl.enter();
      expect(this.rl.output.__raw__).to.contain("zfolder2");
    });
    //
    it("should allow users to go past basePath", function () {
      this.prompt.run();
      this.rl.moveDown();
      this.rl.enter();
      expect(this.rl.output.__raw__).to.contain("..");
      expect(this.prompt.opt.choices.realChoices[1].name).to.equal("..");
    });

    it("should not display back option in root folder", function () {
      this.prompt.run();
      while (this.prompt.currentPath !== path.parse(path.resolve(".")).root) {
        this.rl.moveDown();
        this.rl.enter();
      }
      expect(this.rl.output.__raw__).to.not.contain("..");
    });

    it("should allow users to go back using '-' shortcut", function () {
      this.prompt.run();
      expect(this.rl.output.__raw__).to.contain("zfolder2");
      this.rl.keyPress("-");
      expect(this.rl.output.__raw__).to.contain("..");
      expect(this.rl.output.__raw__).to.not.contain("zfolder2");
    });

    it("should allow users search for a folder using '/' shortcut", function () {
      this.prompt.run();
      expect(this.rl.output.__raw__).to.not.contain("Search:");
      this.rl.keyPress("/");
      expect(this.rl.output.__raw__).to.not.contain(figures.pointer + " 📂  folder1");
      expect(this.rl.output.__raw__).to.contain("Search:");
      this.rl.keyPress("f");

      expect(this.rl.output.__raw__).to.have.string(figures.pointer + " 📁  folder1");
      this.rl.sendWord("older2");
      expect(this.rl.output.__raw__).to.contain(figures.pointer + " 📁  folder2");
    });

    it("should allow users to select a folder using 'choose this directory' choice", function () {
      this.prompt.run();
      this.rl.moveUp();
      this.rl.enter();
      expect(this.prompt.currentPath.split(/\/|\\|\\\\/).slice(-1)[0]).to.equal("root");
    });

    it("should allow users to select a folder using '.' choice", function () {
      this.prompt.run();
      this.rl.enter();
      expect(this.prompt.currentPath.split(/\/|\\|\\\\/).slice(-1)[0]).to.equal("root");
    });

    it('should not go back using "-" in searchMode', function () {
      this.prompt.run();
      this.rl.keyPress("/");
      this.rl.keyPress("-");
      expect(this.prompt.currentPath.split(/\/|\\|\\\\/).slice(-1)[0]).to.equal("root");
    });

    it('allow only one search instance at the time', function () {
      this.prompt.run();
      this.rl.keyPress("/");
      this.rl.keyPress("a");
      this.rl.keyPress("/");
      this.rl.keyPress("b");
      expect(this.rl.output.__raw__).to.contain("Search: ab");
    });
    // it("should allow users to press keys to shortcut to that value", function (done) {
    //     prompt.run(function (answer) {
    //       expect(answer).to.equal("zfolder2");
    //       done();
    //     });
    //     keyPress("z");
    //     enter();
    //     enter();
    // });
    it("should allow users to select the curring folder using '.' shortcut", function () {
      this.prompt.run();
      this.rl.keyPress(".");
      expect(this.prompt.currentPath.split(/\/|\\|\\\\/).slice(-1)[0]).to.equal("root");
    });
  });
  describe("display hidden folder", function () {

    before(function () {
      mock({
        "root": {
          ".git": {},
          "folder1": {
            "folder1-1": {}
          },
          "folder2": {},
          "zfolder2": {},
          "some.png": new Buffer([8, 6, 7, 5, 3, 0, 9]),
          "a-symlink": mock.symlink({
            path: "folder1"
          })
        }
      });
      this.rl = new ReadlineStub();
      this.prompt = new Prompt({
        message: "Choose a directory",
        name: "name",
        basePath: "./root/",
        options: {
          displayHidden: "true"
        }
      }, this.rl);
    });

    after(function () {
      mock.restore();
      this.rl.output.clear();
    });

    it("should contain folders starting with '.' (private folders)", function () {
      this.prompt.run();
      expect(this.rl.output.__raw__).to.contain(".git");
    });
  });
   describe("display files ", function () {

    before(function () {
      mock({
        "root": {
          ".git": {},
          "folder1": {
            "folder1-1": {}
          },
          "folder2": {},
          "zfolder2": {},
          "some.png": new Buffer([8, 6, 7, 5, 3, 0, 9]),
          "a-symlink": mock.symlink({
            path: "folder1"
          })
        }
      });
      this.rl = new ReadlineStub();
      this.prompt = new Prompt({
        message: "Choose a directory",
        name: "name",
        basePath: "./root/",
        options: {
          displayFiles: true
        }
      }, this.rl);
    });

    after(function () {
      mock.restore();
      this.rl.output.clear();
    });

    it("should contain files", function () {
      this.prompt.run();
      expect(this.rl.output.__raw__).to.contain("some.png");
    });
  });
  // not sure yet
  // it("should allow users to press keys to shortcut to that value", function (done) {
  //     prompt.run(function (answer) {
  //       expect(answer).to.equal("zfolder2");
  //       done();
  //     });
  //     keyPress("z");
  //     enter();
  //     enter();
  // });

});
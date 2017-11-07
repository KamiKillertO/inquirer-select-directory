"use strict";
/**
 * `directory` type prompt
 */
var rx = require("rx-lite");
var util = require("util");
var chalk = require("chalk");
var figures = require("figures");
var cliCursor = require("cli-cursor");
var Base = require("inquirer/lib/prompts/base");
var observe = require("inquirer/lib/utils/events");
var Paginator = require("inquirer/lib/utils/paginator");
var Choices = require("inquirer/lib/objects/choices");
var Separator = require("inquirer/lib/objects/separator");

var path = require("path");
var fs = require("fs");

/**
 * Constants
 */
var CHOOSE = 'choose this directory';
var BACK = '..';
var CURRENT = '.';

/**
 * Function for rendering list choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */
function listRender(choices, pointer) {
    var output = '';
    var separatorOffset = 0;

    choices.forEach(function (choice, index) {
        if (choice.type === 'separator') {
            separatorOffset++;
            output += "  " + choice + "\n";
            return;
        }

        var isSelected = (index - separatorOffset === pointer);
        var line = (isSelected ? figures.pointer + ' ' : '  ');

        if (choice.isDirectory) {
          if (choice.name === '.') {
            line += '📂  ';
          } else {
            line += '📁  ';
          }
        }
        if (choice.isFile) {
          line += '📄  ';
        }
        line += choice.name;
        if (isSelected) {
          line = chalk.cyan(line);
        }
        output += line + ' \n';
    });

    return output.replace(/\n$/, '');
}

/**
 * Function for getting list of folders in directory
 * @param  {String} basePath                the path the folder to get a list of containing folders
 * @param  {Boolean} [displayHidden=false]  set to true if you want to get hidden files
 * @param  {Boolean} [displayFiles=false]  set to true if you want to get files
 * @return {Array}                          array of folder names inside of basePath
 */
function getDirectoryContent(basePath, displayHidden, displayFiles) {
    return fs
        .readdirSync(basePath)
        .filter(function (file) {
            try {
                var stats = fs.lstatSync(path.join(basePath, file));
                if (stats.isSymbolicLink()) {
                    return false;
                }
                var isDir = stats.isDirectory();
                var isFile = stats.isFile() && displayFiles;
                if (displayHidden) {
                  return isDir || displayFiles;
                }
                var isNotDotFile = path.basename(file).indexOf(".") !== 0;
                return (isDir || isFile) && isNotDotFile;
            } catch (error) {
                return false;
            }
        })
        .sort();
}

function updateChoices(choices, basePath) {
  choices.forEach(function (choice, i) {
    if (choice.type === undefined) {
      try {
        var stats = fs.lstatSync(path.join(basePath, choice.value));
        choice.isDirectory = stats.isDirectory();
        choice.isFile = stats.isFile();
        choices[i] = choice;
      } catch (error) {
        // console.log(error);
      }
    }
  });
  return choices;
}

/**
 * Constructor
 */
function Prompt() {
    Base.apply(this, arguments);
    if (!this.opt.basePath) {
        this.throwParamError('basePath');
    }
    try {
        this.opt.displayHidden = this.opt.options.displayHidden;
    } catch (e) {
        this.opt.displayHidden = false;
    }

    try {
        this.opt.displayFiles = this.opt.options.displayFiles;
    } catch (e) {
        this.opt.displayFiles = false;
    }
    this.currentPath = path.isAbsolute(this.opt.basePath) ? path.resolve(this.opt.basePath) : path.resolve(process.cwd(), this.opt.basePath);
    this.root = path.parse(this.currentPath).root;
    this.opt.choices = new Choices(this.createChoices(this.currentPath), this.answers);
    this.selected = 0;

    // Make sure no default is set (so it won"t be printed)
    this.opt.default = null;

    this.searchTerm = '';

    this.paginator = new Paginator();
}
util.inherits(Prompt, Base);

/**
 * Start the Inquiry session
 * @param  {Function} callback      Callback when prompt is done
 * @return {this}
 */

Prompt.prototype._run = function (callback) {
    var self = this;
    self.searchMode = false;
    this.done = callback;
    var alphaNumericRegex = /\w|\.|-/i;
    var events = observe(this.rl);


    var keyUps = events.keypress.filter(function (evt) {
        return evt.key.name === 'up';
    }).share();

    var keyDowns = events.keypress.filter(function (evt) {
        return evt.key.name === 'down';
    }).share();

    var keySlash = events.keypress.filter(function (evt) {
        return evt.value === '/' && !self.searchMode;
    }).share();

    var keyMinus = events.keypress.filter(function (evt) {
        return evt.value === '-' && !self.searchMode;
    }).share();

    var dotKey = events.keypress.filter(function (evt) {
        return evt.value === '.' && !self.searchMode;
    }).share();

    var alphaNumeric = events.keypress.filter(function (evt) {
        return evt.key.name === 'backspace' || alphaNumericRegex.test(evt.value);
    }).share();

    var searchTerm = keySlash.flatMap(function () {
        self.searchMode = true;
        self.searchTerm = '';
        self.render();
        var end$ = new rx.Subject();
        var done$ = rx.Observable.merge(events.line, end$);
        return alphaNumeric.map(function (evt) {
                if (evt.key.name === 'backspace' && self.searchTerm.length) {
                    self.searchTerm = self.searchTerm.slice(0, -1);
                } else if (evt.value) {
                    self.searchTerm += evt.value;
                }
                if (self.searchTerm === '') {
                    end$.onNext(true);
                }
                return self.searchTerm;
            })
            .takeUntil(done$)
            .doOnCompleted(function () {
                self.searchMode = false;
                self.render();
                return false;
            });
    }).share();

    var outcome = this.handleSubmit(events.line);
    outcome.drill.forEach(this.handleDrill.bind(this));
    outcome.back.forEach(this.handleBack.bind(this));
    keyUps.takeUntil(outcome.done).forEach(this.onUpKey.bind(this));
    keyDowns.takeUntil(outcome.done).forEach(this.onDownKey.bind(this));
    keyMinus.takeUntil(outcome.done).forEach(this.handleBack.bind(this));
    dotKey.takeUntil(outcome.done).forEach(this.onSubmit.bind(this));
    events.keypress.takeUntil(outcome.done).forEach(this.hideKeyPress.bind(this));
    searchTerm.takeUntil(outcome.done).forEach(this.onKeyPress.bind(this));
    outcome.done.forEach(this.onSubmit.bind(this));

    // Init the prompt
    cliCursor.hide();
    this.render();

    return this;
};


/**
 * Render the prompt to screen
 * @return {Prompt} self
 */

Prompt.prototype.render = function () {
    updateChoices(this.opt.choices, this.opt.basePath);
    // Render question
    var message = this.getQuestion();

    // Render choices or answer depending on the state
    if (this.status === 'answered') {
        message += chalk.cyan(this.currentPath);
    } else {
        message += chalk.bold('\n Current directory: ') + chalk.cyan(path.resolve(this.opt.basePath, this.currentPath));
        message += chalk.bold('\n');
        var choicesStr = listRender(this.opt.choices, this.selected);
        message += '\n' + this.paginator.paginate(choicesStr, this.selected, this.opt.pageSize);
        if (this.searchMode) {
            message += ('\nSearch: ' + this.searchTerm);
        } else {
            message += chalk.dim('\n(Use "/" key to search this directory)');
            message += chalk.dim('\n(Use "-" key to navigate to the parent folder');
        }
    }
    this.screen.render(message);
};


/**
 * When user press `enter` key
 *
 * @param {any} e
 * @returns
 */
Prompt.prototype.handleSubmit = function (e) {
    var self = this;
    var obx = e.map(function () {
        return self.opt.choices.getChoice(self.selected).value;
    }).share();

    var done = obx.filter(function (choice) {
        return choice === CHOOSE || choice === CURRENT;
    }).take(1);
    var back = obx.filter(function (choice) {
        return choice === BACK;
    }).takeUntil(done);

    var drill = obx.filter(function (choice) {
        return choice !== BACK && choice !== CHOOSE && choice !== CURRENT;
    }).takeUntil(done);

    return {
        done: done,
        back: back,
        drill: drill
    };
};

/**
 *  when user selects to drill into a folder (by selecting folder name)
 */
Prompt.prototype.handleDrill = function () {
    var choice = this.opt.choices.getChoice(this.selected);
    this.currentPath = path.join(this.currentPath, choice.value);
    this.opt.choices = new Choices(this.createChoices(this.currentPath), this.answers);
    this.selected = 0;
    this.render();
};

/**
 * when user selects ".. back"
 */
Prompt.prototype.handleBack = function () {
    this.currentPath = path.dirname(this.currentPath);
    this.opt.choices = new Choices(this.createChoices(this.currentPath), this.answers);
    this.selected = 0;
    this.render();
};

/**
 * when user selects 'choose this folder'
 */
Prompt.prototype.onSubmit = function ( /*value*/ ) {
    this.status = 'answered';

    // Rerender prompt
    this.render();

    this.screen.done();
    cliCursor.show();
    this.done(path.resolve(this.opt.basePath, this.currentPath));
};


/**
 * When user press a key
 */
Prompt.prototype.hideKeyPress = function () {
    if (!this.searchMode) {
        this.render();
    }
};

Prompt.prototype.onUpKey = function () {
    var len = this.opt.choices.realLength;
    this.selected = (this.selected > 0) ? this.selected - 1 : len - 1;
    this.render();
};

Prompt.prototype.onDownKey = function () {
    var len = this.opt.choices.realLength;
    this.selected = (this.selected < len - 1) ? this.selected + 1 : 0;
    this.render();
};

Prompt.prototype.onSlashKey = function ( /*e*/ ) {
    this.render();
};

Prompt.prototype.onKeyPress = function ( /*e*/ ) {
    var item;
    for (var index = 0; index < this.opt.choices.realLength; index++) {
        item = this.opt.choices.realChoices[index].name.toLowerCase();
        if (item.indexOf(this.searchTerm) === 0) {
            this.selected = index;
            break;
        }
    }
    this.render();
};

/**
 * Helper to create new choices based on previous selection.
 */
Prompt.prototype.createChoices = function (basePath) {
    var choices = getDirectoryContent(basePath, this.opt.displayHidden, this.opt.displayFiles);
    if (basePath !== this.root) {
        choices.unshift(BACK);
    }
    choices.unshift(CURRENT);
    if (choices.length > 0) {
        choices.push(new Separator());
    }
    choices.push(CHOOSE);
    choices.push(new Separator());
    return choices;
};


/**
 * Module exports
 */

module.exports = Prompt;

// TODO: SEARCH DOES NOT SUPPORT UPPERCASE
// TODO: Add theming option id:2
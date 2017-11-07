/**
 * Directory prompt example
 */

"use strict";
var inquirer = require("inquirer");
var fs = require('fs');

inquirer.registerPrompt("directory", require("../src/index"));

inquirer.prompt([{
    type: "directory",
    name: "path",
    message: "In what directory would like to create an new file?",
    basePath: "./",
    options: {
      displayFiles: true
    }
}]).then(function(answers) {
    fs.writeFile(answers.path + '/file.txt', 'Whoa! You have created this file');
});
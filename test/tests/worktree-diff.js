'use strict';

const path = require("path");
const fs = require('fs-extra');
const utils = require("./test-utils");
const eol = require('../../lib/text-eol');
const vcs = require('../../lib/repo-vcs-implement');

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

describe("Worktree Diff #core", function() {
    describe("Text Diff", function() {

        function eolNotConvert(text) { return text; }

        const multiLinesArr = [
            'first1\nsecond1\r\nthird1\n',
            'first_fjdifjeiojs2\r\nsecond_fjdkslfjkdslkl2\nthird_fjdklfjioejfkld2\r\n',
            'fdkjflds\nfdjklfdjs\nfdjfeiojo\r\nfdjkvncklxvnd\r\nkdfljsdklflvc\nfjie89vj8r\nkvfioe\n',
            '\n\r\nfdjksfieojiovdjkjfdklj',
            '\r\n\r\n\nfjiofwejiojkd\njfildjfjioej\n'];

        const empty = '';
        const emptyLines = '\n\r\n\r\n\n\n\r\n';
        const singleLine = 'jeiofjiofjeiomjifomidlsf';

        const eolFuncs = [
            eol.toLf,
            eol.toCr,
            eol.toCrLf,
            eolNotConvert,
            utils.eolToRandom
        ];

        const basePath = utils.PLAYGROUND_PATH;
        const sourcePath = path.join(basePath, 'source');
        const refPath = path.join(basePath, 'ref');

        function initPath(sourceContent, refContent) {
            return fs.writeFile(sourcePath, sourceContent)
            .then(() => fs.writeFile(refPath, refContent))
            .catch(err => {
                console.error('init path error: ' + err);
                throw err;
            });
        }

        function assertEqualily(testCase, equality) {
            return vcs.textFilesEqual(sourcePath, refPath)
            .should.eventually.equal(equality, `Expect ${equality ? 'equal' : 'inequal'} for ${testCase}`);
        }

        function assertEqual(testCase) {
            return assertEqualily(testCase, true);
        }

        function assertInequal(testCase) {
            return assertEqualily(testCase, false);
        }

        before("Ensure playground", function() {
            return fs.emptyDir(basePath)
            .catch(err => {
                console.error('before each error: ' + err);
                throw err;
            });
        })

        let output;
        const originalLog = console.log;
        beforeEach("Avoid log directly", function() {
            output = '';
            console.log = (msg) => {
                output += msg + '\n';
            };
        });

        afterEach("Log if needed", function() {
            console.log = originalLog;
            if (this.currentTest.state === 'failed') {
                console.log(output);
            }
        });

        after("Clean up", function() {
            console.log = originalLog;
            return fs.remove(basePath);
        })

        describe("Equal", function() {

            describe('Same Equals', function() {
                eolFuncs.forEach((eolFunc, eolIndex) => {
                    multiLinesArr.forEach((multiLines, multiLinesIndex) => {
                        let content = eolFunc(multiLines);
                        let testCase = `multi-line ${multiLinesIndex}, eol ${eolIndex}`;
                        it(testCase, function() {
                            return initPath(content, content)
                            .then(() => assertEqual(testCase));
                        });
                    })
    
                    let emptyLinesConverted = eolFunc(emptyLines);
                    let testCase = `empty lines, eol ${eolIndex}`;
                    it(testCase, function() {
                        return initPath(emptyLinesConverted, emptyLinesConverted)
                        .then(() => assertEqual(testCase));
                    });
                })

                it('empty', function() {
                    return initPath(empty, empty)
                    .then(() => assertEqual('empty'));
                });

                it('single line', function() {
                    return initPath(singleLine, singleLine)
                    .then(() => assertEqual('single line'));
                })
            });

            describe('EOL Insensitive', function() {
                for (let sourceEolIndex = 0; sourceEolIndex < eolFuncs.length - 1; sourceEolIndex++) {
                    for (let refEolIndex = 0; refEolIndex < eolFuncs.length - 1; refEolIndex++) {
                        if (sourceEolIndex !== refEolIndex) {
                            multiLinesArr.forEach((multiLines, multiLinesIndex) => {
                                let sourceContent = eolFuncs[sourceEolIndex](multiLines);
                                let refContent = eolFuncs[refEolIndex](multiLines);
                                let testCase = `multi-line ${multiLinesIndex}, source eol: ${sourceEolIndex}, ref eol: ${refEolIndex}`;

                                it(testCase, function() {
                                    return initPath(sourceContent, refContent)
                                    .then(() => assertEqual(testCase));
                                })
                            });

                            let emptyLinesSource = eolFuncs[sourceEolIndex](emptyLines);
                            let emptyLinesRef = eolFuncs[refEolIndex](emptyLines);
                            let testCase = `empty lines, source eol: ${sourceEolIndex}, ref eol: ${refEolIndex}`;
                            it(testCase, function() {
                                return initPath(emptyLinesSource, emptyLinesRef)
                                .then(() => assertEqual(testCase));
                            });
                        }
                    }
                }
            });

            describe('Insensitive to number of EOL and space', function() {
                let referenceLines = [];
                for (let i = 0; i < 10; i++) {
                    referenceLines.push(`line-${i}`);
                }

                let articles = {};
                articles['all single eol'] = referenceLines.join('\n');

                articles['all single space'] = referenceLines.join(' ');

                articles['all two eols'] = referenceLines.join('\r\n\r\n');

                articles['mixed space and eols'] = referenceLines.join('\r\n \n  ');

                let keys = Object.keys(articles);

                for (let i = 0; i < keys.length; i++) {
                    for (let j = i + 1; j < keys.length; j++) {
                        let sourceName = keys[i];
                        let refName = keys[j];
                        let sourceArticle = articles[sourceName];
                        let refArticle = articles[refName];

                        let testCase = `source: ${sourceName}; ref: ${refName}`;
                        it (testCase, function() {
                            return initPath(sourceArticle, refArticle)
                            .then(() => assertEqual(testCase));
                        })

                    }
                }
            })
        })

        describe("Different", function() {
            let contents = Object.assign([], multiLinesArr);
            let contentNames = [];
            for (let i = 0; i < contents.length; i++) {
                contentNames.push(`multi-line ${i}`);
            }

            contents.push(empty);
            contentNames.push('empty');

            contents.push(singleLine);
            contentNames.push('single line');

            for (let sourceEolIndex = 0; sourceEolIndex < eolFuncs.length; sourceEolIndex++) {
                let sourceEol = eolFuncs[sourceEolIndex];

                for (let refEolIndex = sourceEolIndex + 1; refEolIndex < eolFuncs.length; refEolIndex++) {
                    let refEol = eolFuncs[refEolIndex];

                    for (let sourceIndex = 0; sourceIndex < contents.length; sourceIndex++) {
                        let sourceContent = contents[sourceIndex];
                        
                        for (let refIndex = sourceIndex + 1; refIndex < contents.length; refIndex++) {
                            let refContent = contents[refIndex];
                            let sourceContentConverted = sourceEol(sourceContent);
                            let refContentConverted = refEol(refContent);
                            let testCase = `source: ${contentNames[sourceIndex]}, source eol: ${sourceEolIndex}, ref: ${contentNames[refIndex]}, ref eol: ${refEolIndex}`;

                            it(testCase, function() {
                                return initPath(sourceContentConverted, refContentConverted)
                                .then(() => assertInequal(testCase));
                            })
                        }
                    }
                }
            }
        })
    })
})
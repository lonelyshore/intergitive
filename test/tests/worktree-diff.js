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
            eol.toRandom
        ];

        const basePath = utils.PLAYGROUND_PATH;
        const sourcePath = path.join(basePath, 'source');
        const refPath = path.join(basePath, 'ref');

        function initPath(sourceContent, refContent) {
            return fs.writeFile(sourcePath, sourceContent)
            .then(() => fs.writeFile(refPath, refContent));
        }

        function assertEqual(testCase) {
            return vcs.textFilesEqual(sourcePath, refPath)
            .should.eventually.equal(true, `Expect equal for ${testCase}`);
        }

        beforeEach("Ensure playground", function() {
            return fs.emptyDir(basePath);
        })

        describe.only("Equal", function() {
            describe('Same Equals', function() {
                eolFuncs.forEach(eolFunc => {
                    for (let i = 0; i < multiLinesArr.length; i++) {
                        let content = eolFunc(multiLinesArr[i]);
                        let testCase = `multi-line ${i}`;
                        it(testCase, function() {
                            return initPath(content, content)
                            .then(() => assertEqual(testCase));
                        });
                    }
    
                    let emptyLinesConverted = eolFunc(emptyLines);
                    it('empty lines', function() {
                        return initPath(emptyLinesConverted, emptyLinesConverted)
                        .then(() => assertEqual('empty lines'));
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
            })
        })

        describe("Different", function() {

        })
    })
})
"use strict";

var jshint = require('jshint@2.7.0').JSHINT,
    Promise = require('bluebird@2.9.26'),
    request = Promise.promisifyAll(require("request"));

/**
 * Scans each commit in a push for JavaScript errors and reports any findings as a comment in the commit.
 *
 * @param {object} context
 * @param {callback} callback
 * @returns {*}
 */
return function(context, callback) {
  var payload = context.webhook,
      commits = payload.commits,
      commitsUrl = payload.repository.commits_url,
      contentsUrl = payload.repository.contents_url,
      MESSAGES = {
        AUTO: 'AUTO-MESSAGE',
        JS_ERRORS: 'JSHint detected errors in the following files',
        SUCCESS_COMMENT: 'Commented commit',
        NO_ERRORS: 'No JS errors found',
        FAIL_COMMENT: 'Failed to comment a commit',
        FAIL_READ: 'Failed to read file'
      },
      // Warning: The enforceall flag will be deprecated in future jsHint releases
      jsHintConfig = { enforceall: true },
      userAgent = 'LuxDie/webtask-test';

  // Get the contents of a file in a specific commit 
  function readFile(path, commit) {
    var reqData = {
      url: contentsUrl.replace('{+path}', path) + '?ref=' + commit.id,
      headers: {
        // User-Agent header is required by the Github API
        'User-Agent': userAgent,
        // The 'Accept Raw' header returns the file as text rather than binary
        'Accept': 'application/vnd.github.VERSION.raw'
      }
    };
    return request.getAsync(reqData).spread(function (response, body) {
      if (response.statusCode === 200) {
        return body;
      } else {
        callback(MESSAGES.FAIL_READ + ': ' + response.statusCode + ' ' + JSON.parse(body).message);
      }
      }).catch(function (error) {
        callback(MESSAGES.FAIL_READ + ': ' + error.message);
      });
  }
  
  // Get all the edited JS files in a commit
  function getJsFiles(commit) {
    return commit.added.concat(commit.modified).filter(function (file) {
      return file.indexOf('.js') > -1;
    }).map(function (file) {
      return { path: file };
    });
  }

  // Make a report for each commit
  commits.forEach(function (commit) {
    var reqData, jsFiles, jsFilesContents, jsFilesErr;

    jsFiles = getJsFiles(commit);
    // jsFilesContents holds a collection of 1 promise for each JS file in the commit, which resolve to the contents of the files
    jsFilesContents = jsFiles.map(function (file) {
      return readFile(file.path, commit).then(function(content) {
        // Scan each file for JS errors
        jshint(content, jsHintConfig);
        // Mark each file with the amount of errors it has, if any
        file.err = jshint.errors ? jshint.errors.length : 0;
      });
    });

    // When all files for the current commit have been scanned, if any errors were found, proceed to report errors as a comment for the
    // commit
    Promise.all(jsFilesContents).then(function () {
      jsFilesErr = jsFiles.map(function (file) {
        if (file.err) {
          return file.path;
        }
      });
      if (jsFilesErr.length) {
        reqData = {
          url: commitsUrl.replace('{/sha}', '/' + commit.id) + '/comments',
          headers: {
            'User-Agent': userAgent,
            'Authorization': 'token ' + context.data.github_token
          },
          json: {
            'body': MESSAGES.AUTO + ' - ' + MESSAGES.JS_ERRORS + ': ' + jsFilesErr.join(', ')
          }
        };
        request.postAsync(reqData).spread(function (response, body) {
          if (response.statusCode === 201) {
            callback(null, { success: MESSAGES.SUCCESS_COMMENT });
          } else {
            callback(MESSAGES.FAIL_COMMENT + ': ' + response.statusCode + ' ' + JSON.parse(body).message);
          }
        }).catch(function (error) {
          callback(MESSAGES.FAIL_COMMENT + ': ' + error.message);
        });
      } else {
        callback(null, { success: MESSAGES.NO_ERRORS });
      }
    });
  });
};
